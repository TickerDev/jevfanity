import type {
  Category,
  ModerationLevel,
  NoulAnswer,
  TypeSafeResponse,
} from "./types";

type QuestionDefinition = {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
};

export const ALL_CATEGORIES: Category[] = [
  "profanity",
  "slur",
  "harassment",
  "threat",
  "sexual",
];

export const ALL_LEVELS: ModerationLevel[] = ["low", "medium", "strict"];

const QUESTIONS: Record<Category, Omit<QuestionDefinition, "criteria">> = {
  profanity: {
    type: "noul",
    instructions:
      "Does the text violate this policy's rule for profanity or vulgar language? Consider language-specific slang and context.",
  },
  slur: {
    type: "noul",
    instructions:
      "Does the text violate this policy's rule for slurs or group-based epithets? Consider language-specific slang and context.",
  },
  harassment: {
    type: "noul",
    instructions:
      "Does the text violate this policy's rule for harassment or targeted abuse? Consider language-specific slang and context.",
  },
  threat: {
    type: "noul",
    instructions:
      "Does the text violate this policy's rule for threats or intimidation? Consider language-specific slang and context.",
  },
  sexual: {
    type: "noul",
    instructions:
      "Does the text violate this policy's rule for sexual language or content? Consider language-specific slang and context.",
  },
};

const POLICY_CRITERIA: Record<
  ModerationLevel,
  Record<Category, QuestionDefinition["criteria"]>
> = {
  low: {
    profanity: {
      true:
        "Contains extreme, graphic, or aggressively degrading obscene language. Isolated f-bombs and ordinary casual swearing are allowed.",
      false:
        "Contains no extreme obscenity. Allow isolated f-bombs, casual swearing, ordinary criticism, and language mentioned only as an example.",
    },
    slur: {
      true:
        "Uses severe targeted hate speech, dehumanizing group-based abuse, or an unmistakably extreme slur attack.",
      false:
        "Contains no severe targeted hate speech. Do not flag casual insults, ambiguous slang, quoted discussion, or non-targeted language by itself.",
    },
    harassment: {
      true:
        "Contains severe or sustained targeted abuse, dehumanization, intimidation, or encouragement of abuse against a person.",
      false:
        "Contains no severe harassment. Allow rude tone, ordinary insults, disagreement, criticism, and non-targeted profanity.",
    },
    threat: {
      true:
        "Expresses a credible, specific, or forceful intent to physically harm a person, animal, or property.",
      false:
        "Contains no credible threat. Figurative phrases, obvious jokes, fictional events, and neutral discussion of threats do not count.",
    },
    sexual: {
      true:
        "Contains graphic descriptions of sexual acts, an explicit sexual proposition, or extreme obscene sexual content.",
      false:
        "Contains no graphic sexual content. Allow non-graphic romance, mild innuendo, and ordinary educational anatomy.",
    },
  },
  medium: {
    profanity: {
      true:
        "Contains repeated strong profanity, sexual use of strong profanity, or vulgar language beyond what is typical in a PG-13 movie.",
      false:
        "Contains at most mild swearing or an isolated non-sexual f-bomb. Ordinary criticism and quoted discussion do not count by themselves.",
    },
    slur: {
      true:
        "Uses a clear derogatory slur or demeaning group-based epithet, including an obvious obfuscated spelling.",
      false:
        "Contains no clear derogatory slur. Neutral identity references, ambiguous slang, and discussion or quotation without endorsement do not count by themselves.",
    },
    harassment: {
      true:
        "Contains strong targeted insults, degrading attacks, bullying, intimidation, or sustained demeaning language.",
      false:
        "Contains no strong harassment. Mild insults, disagreement, criticism, and non-targeted profanity do not count by themselves.",
    },
    threat: {
      true:
        "Expresses an actual threat, stated intent, or coercive warning of physical harm or destructive action.",
      false:
        "Contains no actual threat. Figurative phrases, obvious jokes, fictional events, and neutral discussion of threats do not count by themselves.",
    },
    sexual: {
      true:
        "Contains explicit descriptions of sexual acts, explicit sexual requests, or graphic sexual language.",
      false:
        "Contains no explicit sexual content. Non-graphic romance, educational anatomy, and mild innuendo do not count by themselves.",
    },
  },
  strict: {
    profanity: {
      true:
        "Contains any profanity, vulgar swearing, obscene curse language, or censored profanity whose intended meaning is clear.",
      false:
        "Contains no profanity or vulgar language. Ordinary criticism and words discussed only as language examples do not count by themselves.",
    },
    slur: {
      true:
        "Contains any derogatory slur or demeaning group-based epithet, including casual, reclaimed, or obfuscated use when the intended term is clear.",
      false:
        "Contains no slur or group-based epithet. Neutral identity references and purely educational discussion do not count by themselves.",
    },
    harassment: {
      true:
        "Contains any targeted abusive insult, bullying, degrading attack, intimidation, or demeaning language directed at a person.",
      false:
        "Contains no targeted abuse. Respectful disagreement, neutral criticism, and non-targeted statements do not count by themselves.",
    },
    threat: {
      true:
        "Expresses or implies intent, desire, intimidation, or a coercive warning involving physical harm or destructive action.",
      false:
        "Contains no threatening or intimidating content. Clearly fictional descriptions and neutral safety discussion do not count by themselves.",
    },
    sexual: {
      true:
        "Contains explicit or age-inappropriate sexual language, sexual propositions, descriptions of sexual acts, or clearly sexual innuendo.",
      false:
        "Contains no age-inappropriate sexual content. Clinical educational anatomy and non-sexual affection do not count by themselves.",
    },
  },
};

export function normalizeThreshold(
  value: unknown,
  fallback = 0.75,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

export function buildQuestions(
  categories: Category[],
  level: ModerationLevel,
) {
  return Object.fromEntries(
    categories.map((category) => [
      category,
      {
        ...QUESTIONS[category],
        criteria: POLICY_CRITERIA[level][category],
      },
    ]),
  );
}

export function combineModerationResponses(
  responses: TypeSafeResponse[],
  categories: Category[],
): TypeSafeResponse {
  const answers = Object.fromEntries(
    categories.map((category) => [
      category,
      {
        type: "noul",
        noul: Math.max(
          ...responses.map(
            (response) => response.answers[category]?.noul ?? 0,
          ),
        ),
      } satisfies NoulAnswer,
    ]),
  );

  return {
    model: responses[0]?.model ?? "unknown",
    answers,
    usage: {
      input_tokens: responses.reduce(
        (total, response) => total + (response.usage?.input_tokens ?? 0),
        0,
      ),
      output_tokens: responses.reduce(
        (total, response) => total + (response.usage?.output_tokens ?? 0),
        0,
      ),
    },
  };
}

export function formatModerationResult(
  response: TypeSafeResponse,
  categories: Category[],
  threshold: number,
  level: ModerationLevel,
) {
  const scores = Object.fromEntries(
    categories.map((category) => [
      category,
      clamp01(response.answers[category]?.noul ?? 0),
    ]),
  ) as Record<Category, number>;

  const flaggedCategories = categories.filter(
    (category) => scores[category] >= threshold,
  );

  const maxScore =
    categories.length > 0
      ? Math.max(...categories.map((category) => scores[category]))
      : 0;

  return {
    flagged: flaggedCategories.length > 0,
    score: maxScore,
    level,
    threshold,
    categories: scores,
    flagged_categories: flaggedCategories,
    model: response.model,
    usage: response.usage ?? null,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
