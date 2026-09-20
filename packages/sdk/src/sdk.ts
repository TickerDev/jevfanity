export type ModerationLevel = "low" | "medium" | "strict";

export type Category =
  | "profanity"
  | "slur"
  | "harassment"
  | "threat"
  | "sexual";

export interface ModerateOptions {
  level?: ModerationLevel;
  threshold?: number;
  categories?: Category[];
}

export interface ModerateRequest extends ModerateOptions {
  text: string;
}

export interface ModerationResult {
  flagged: boolean;
  score: number;
  level: ModerationLevel;
  threshold: number;
  categories: Record<Category, number>;
  flagged_categories: Category[];
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  processing: {
    estimated_tokens: number;
    chunks: number;
    max_tokens_per_chunk: number;
    unicode_confusable_tokens: number;
  };
}

export interface HealthResult {
  ok: true;
  service: "jevfanity";
}

export interface JevfanityOptions {
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export interface JevfanityApiErrorBody {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export class JevfanityError extends Error {
  readonly status: number;
  readonly body: JevfanityApiErrorBody | null;

  constructor(message: string, status: number, body: JevfanityApiErrorBody | null) {
    super(message);
    this.name = "JevfanityError";
    this.status = status;
    this.body = body;
  }
}

export class Jevfanity {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: JevfanityOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.jevfanity.app").replace(
      /\/$/,
      "",
    );
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async moderate(
    text: string,
    options: ModerateOptions = {},
  ): Promise<ModerationResult> {
    return this.request<ModerationResult>("/v1/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...options }),
    });
  }

  async health(): Promise<HealthResult> {
    return this.request<HealthResult>("/v1/health");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);

    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    let response: Response;

    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers,
      });
    } catch (error) {
      throw new JevfanityError(
        error instanceof Error ? error.message : "The request failed.",
        0,
        null,
      );
    }

    const rawBody = await response.text();
    let body: T | JevfanityApiErrorBody | null = null;

    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const errorBody = isErrorBody(body) ? body : null;
      throw new JevfanityError(
        errorBody?.message ?? `Request failed with status ${response.status}.`,
        response.status,
        errorBody,
      );
    }

    return body as T;
  }
}

function isErrorBody(value: unknown): value is JevfanityApiErrorBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default Jevfanity;