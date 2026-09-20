import removeConfusables from "confusables";
import type { EntryType } from "@typesafe-ai/sdk";

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const ASCII_LETTER = /[a-z]/i;
const NON_ASCII = /[^\x00-\x7f]/;

export function buildModerationState(text: string): {
  state: EntryType;
  confusableTokenCount: number;
} {
  let confusableTokenCount = 0;

  const normalizedComparison = text.replace(/\S+/gu, (token) => {
    if (!NON_ASCII.test(token)) {
      return token;
    }

    const normalized = removeConfusables(token.normalize("NFKC"));
    const revealsAsciiWord =
      normalized !== token &&
      PRINTABLE_ASCII.test(normalized) &&
      ASCII_LETTER.test(normalized);

    if (!revealsAsciiWord) {
      return token;
    }

    confusableTokenCount += 1;
    return normalized;
  });

  if (confusableTokenCount === 0) {
    return { state: text, confusableTokenCount };
  }

  return {
    state: {
      original_text: text,
      normalized_comparison: normalizedComparison,
      unicode_policy:
        "Unicode is allowed and is not itself a violation. Use normalized_comparison only to understand words disguised with lookalike characters, then apply the selected content policy to their meaning and context.",
    },
    confusableTokenCount,
  };
}