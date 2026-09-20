import {
  APIError,
  APITimeoutError,
  TypeSafeClient,
} from "@typesafe-ai/sdk";
import {
  ALL_CATEGORIES,
  ALL_LEVELS,
  buildQuestions,
  combineModerationResponses,
  formatModerationResult,
  normalizeThreshold,
} from "./moderation";
import type {
  Category,
  Env,
  ModerateRequest,
  ModerationLevel,
} from "./types";

const MAX_TEXT_LENGTH = 10_000;
const MAX_CHUNK_TOKENS = 100;
const CHUNK_OVERLAP_TOKENS = 10;
const MAX_CONCURRENT_CHUNKS = 4;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        name: "Jevfanity",
        description: "Tiny Jev-powered profanity and moderation API.",
        endpoints: {
          health: "GET /v1/health",
          moderate: "POST /v1/moderate",
        },
        limits: {
          requests: "20 per minute per client IP and Cloudflare location",
          text_characters: MAX_TEXT_LENGTH,
          tokens_per_chunk: MAX_CHUNK_TOKENS,
        },
      });
    }

    if (url.pathname === "/v1/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "jevfanity",
      });
    }

    if (url.pathname === "/v1/moderate" && request.method === "POST") {
      return moderate(request, env);
    }

    return json(
      {
        error: "not_found",
        message: "Route not found.",
      },
      404,
    );
  },
};

async function moderate(request: Request, env: Env): Promise<Response> {
  if (!env.TYPESAFE_API_KEY) {
    return json(
      {
        error: "server_misconfigured",
        message: "TYPESAFE_API_KEY is not configured.",
      },
      500,
    );
  }



  const rateLimit = await env.RATE_LIMITER.limit({
    key: request.headers.get("CF-Connecting-IP") ?? "local",
  });

  if (!rateLimit.success) {
    return json(
      {
        error: "rate_limit_exceeded",
        message: "Too many moderation requests. Try again in one minute.",
      },
      429,
      { "Retry-After": "60" },
    );
  }

  let body: ModerateRequest;

  try {
    body = (await request.json()) as ModerateRequest;
  } catch {
    return json(
      {
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      },
      400,
    );
  }

  if (typeof body.text !== "string") {
    return json(
      {
        error: "invalid_text",
        message: "`text` must be a string.",
      },
      400,
    );
  }

  const text = body.text.trim();

  if (!text) {
    return json(
      {
        error: "invalid_text",
        message: "`text` cannot be empty.",
      },
      400,
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return json(
      {
        error: "text_too_long",
        message: `Text cannot exceed ${MAX_TEXT_LENGTH} characters.`,
      },
      413,
    );
  }

  const categories = parseCategories(body.categories);

  if (!categories) {
    return json(
      {
        error: "invalid_categories",
        message: `Categories must be chosen from: ${ALL_CATEGORIES.join(", ")}.`,
      },
      400,
    );
  }

  const defaultThreshold = normalizeThreshold(env.DEFAULT_THRESHOLD, 0.75);
  const threshold = normalizeThreshold(body.threshold, defaultThreshold);
  const defaultLevel = isModerationLevel(env.DEFAULT_LEVEL)
    ? env.DEFAULT_LEVEL
    : "medium";
  const level = body.level ?? defaultLevel;

  if (!isModerationLevel(level)) {
    return json(
      {
        error: "invalid_level",
        message: `Level must be chosen from: ${ALL_LEVELS.join(", ")}.`,
      },
      400,
    );
  }

  const { chunks, estimatedTokenCount } = chunkText(text);

  try {
    const client = new TypeSafeClient({
      apiKey: env.TYPESAFE_API_KEY,
      timeout: 15_000,
      retry: { maxRetries: 0 },
    });
    const questions = buildQuestions(categories, level);
    const chunkResults = [];

    for (let index = 0; index < chunks.length; index += MAX_CONCURRENT_CHUNKS) {
      const batch = chunks.slice(index, index + MAX_CONCURRENT_CHUNKS);
      chunkResults.push(
        ...(await Promise.all(
          batch.map((chunk) =>
            client.systemOne({
              state: chunk,
              model: "jev-latest",
              questions,
            }),
          ),
        )),
      );
    }

    const result = combineModerationResponses(chunkResults, categories);

    return json(
      {
        ...formatModerationResult(result, categories, threshold, level),
        processing: {
          estimated_tokens: estimatedTokenCount,
          chunks: chunks.length,
          max_tokens_per_chunk: MAX_CHUNK_TOKENS,
        },
      },
    );
  } catch (error) {
    if (error instanceof APIError) {
      console.error("TypeSafe upstream error", error.status, error.body);

      return json(
        {
          error: "upstream_error",
          message: "The moderation model request failed.",
          status: error.status,
        },
        502,
      );
    }

    const timedOut = error instanceof APITimeoutError;

    console.error("Jevfanity request failed", error);

    return json(
      {
        error: timedOut ? "upstream_timeout" : "upstream_unavailable",
        message: timedOut
          ? "The moderation request timed out."
          : "The moderation service is temporarily unavailable.",
      },
      timedOut ? 504 : 502,
    );
  }
}

function chunkText(text: string): {
  chunks: string[];
  estimatedTokenCount: number;
} {
  const tokens = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  const step = MAX_CHUNK_TOKENS - CHUNK_OVERLAP_TOKENS;

  for (let index = 0; index < tokens.length; index += step) {
    chunks.push(tokens.slice(index, index + MAX_CHUNK_TOKENS).join("").trim());

    if (index + MAX_CHUNK_TOKENS >= tokens.length) {
      break;
    }
  }

  return {
    chunks: chunks.length > 0 ? chunks : [text],
    estimatedTokenCount: tokens.length,
  };
}

function isModerationLevel(value: unknown): value is ModerationLevel {
  return (
    typeof value === "string" &&
    ALL_LEVELS.includes(value as ModerationLevel)
  );
}

function parseCategories(value: unknown): Category[] | null {
  if (value === undefined) {
    return [...ALL_CATEGORIES];
  }

  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const categories = [...new Set(value)];

  if (
    categories.some(
      (category) =>
        typeof category !== "string" ||
        !ALL_CATEGORIES.includes(category as Category),
    )
  ) {
    return null;
  }

  return categories as Category[];
}

function json(
  data: unknown,
  status = 200,
  additionalHeaders?: HeadersInit,
): Response {
  const headers = new Headers(additionalHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return withCors(
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers,
    }),
  );
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
