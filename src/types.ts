export interface Env {
  TYPESAFE_API_KEY: string;
  JEVFANITY_API_KEY?: string;
  DEFAULT_THRESHOLD?: string;
  DEFAULT_LEVEL?: string;
  RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}

export type ModerationLevel = "low" | "medium" | "strict";

export type Category =
  | "profanity"
  | "slur"
  | "harassment"
  | "threat"
  | "sexual";

export interface ModerateRequest {
  text: string;
  level?: ModerationLevel;
  threshold?: number;
  categories?: Category[];
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface TypeSafeResponse {
  model: string;
  answers: Record<string, NoulAnswer>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}
