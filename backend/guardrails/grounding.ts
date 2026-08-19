import { GuardrailResult } from './types.js';

export interface GroundingCheckOptions {
  minTokenOverlapRatio?: number;
  minContentOverlapRatio?: number;
}

/**
 * Normalize text while preserving Hindi and other Unicode scripts.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize Unicode text.
 */
function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Remove extremely common function words.
 *
 * This is intentionally small.
 * We do NOT remove meaningful Hindi/English words aggressively,
 * because extractive grounding should remain strict.
 */
const STOPWORDS = new Set([
  // English
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'am',
  'and',
  'or',
  'but',
  'if',
  'then',
  'than',
  'that',
  'this',
  'these',
  'those',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'from',
  'with',
  'by',
  'as',
  'it',
  'its',
  'they',
  'them',
  'their',
  'he',
  'she',
  'his',
  'her',
  'you',
  'your',
  'we',
  'our',

  // Hindi
  'यह',
  'वह',
  'ये',
  'वे',
  'इस',
  'उस',
  'इन',
  'उन',
  'का',
  'की',
  'के',
  'को',
  'से',
  'में',
  'पर',
  'और',
  'या',
  'एक',
  'है',
  'हैं',
  'था',
  'थी',
  'थे',
  'हो',
  'ही',
  'भी',
]);

/**
 * Return meaningful content tokens.
 */
function contentTokens(
  text: string
): string[] {
  return tokenize(text).filter(
    token =>
      !STOPWORDS.has(token) &&
      token.length >= 2
  );
}

/**
 * Check whether two token arrays share an ordered
 * contiguous phrase of at least minLength tokens.
 */
function hasNGramOverlap(
  answerTokens: string[],
  sourceTokens: string[],
  minLength: number
): boolean {
  if (
    answerTokens.length < minLength ||
    sourceTokens.length < minLength
  ) {
    return false;
  }

  const sourceSet = new Set<string>();

  for (
    let i = 0;
    i <= sourceTokens.length - minLength;
    i++
  ) {
    sourceSet.add(
      sourceTokens
        .slice(i, i + minLength)
        .join(' ')
    );
  }

  for (
    let i = 0;
    i <= answerTokens.length - minLength;
    i++
  ) {
    const phrase =
      answerTokens
        .slice(i, i + minLength)
        .join(' ');

    if (sourceSet.has(phrase)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates that an extracted answer is genuinely grounded
 * in the supplied source passage.
 *
 * This guardrail is intentionally strict:
 *
 * - exact substring → PASS
 * - high token containment → PASS
 * - otherwise requires meaningful content overlap
 *   AND contiguous evidence
 *
 * It does NOT decide whether the retrieved passage itself
 * is relevant to the question. That is the responsibility
 * of the coverage/retrieval guardrails.
 */
export function checkGroundingGuardrail(
  answer: string,
  sourcePassageText: string,
  options: GroundingCheckOptions = {}
): GuardrailResult {
  const minTokenRatio =
    options.minTokenOverlapRatio ?? 0.85;

  const minContentRatio =
    options.minContentOverlapRatio ?? 0.80;

  const ansTrim =
    answer.trim();

  const sourceTrim =
    sourcePassageText.trim();

  if (
    !ansTrim ||
    !sourceTrim
  ) {
    return {
      passed: false,
      status:
        'GROUNDING_FAILED',
      reason:
        'Empty answer or source passage.',
      confidence: 0,
    };
  }

  const normalizedAnswer =
    normalizeText(ansTrim);

  const normalizedSource =
    normalizeText(sourceTrim);

  if (
    !normalizedAnswer ||
    !normalizedSource
  ) {
    return {
      passed: false,
      status:
        'GROUNDING_FAILED',
      reason:
        'Answer or source contained no valid text.',
      confidence: 0,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* 1. Exact substring                                                     */
  /* ---------------------------------------------------------------------- */

  if (
    normalizedSource.includes(
      normalizedAnswer
    )
  ) {
    return {
      passed: true,
      status: 'PASSED',
      confidence: 1.0,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Token grounding                                                     */
  /* ---------------------------------------------------------------------- */

  const sourceTokens =
    tokenize(sourceTrim);

  const answerTokens =
    tokenize(ansTrim);

  if (
    answerTokens.length === 0
  ) {
    return {
      passed: false,
      status:
        'GROUNDING_FAILED',
      reason:
        'Answer contained no valid tokens.',
      confidence: 0,
    };
  }

  const sourceTokenSet =
    new Set(sourceTokens);

  let groundedCount = 0;

  for (
    const token
    of answerTokens
  ) {
    if (
      sourceTokenSet.has(token)
    ) {
      groundedCount++;
    }
  }

  const tokenOverlapRatio =
    groundedCount /
    answerTokens.length;

  /* ---------------------------------------------------------------------- */
  /* 3. Strong token grounding                                              */
  /* ---------------------------------------------------------------------- */

  if (
    tokenOverlapRatio >=
    minTokenRatio
  ) {
    return {
      passed: true,
      status: 'PASSED',
      confidence:
        Math.min(
          1,
          tokenOverlapRatio
        ),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Content-token grounding                                             */
  /* ---------------------------------------------------------------------- */

  const answerContentTokens =
    contentTokens(ansTrim);

  const sourceContentSet =
    new Set(
      contentTokens(
        sourceTrim
      )
    );

  if (
    answerContentTokens.length === 0
  ) {
    return {
      passed: false,
      status:
        'GROUNDING_FAILED',
      reason:
        'Answer contained no meaningful content tokens.',
      confidence:
        tokenOverlapRatio,
    };
  }

  let groundedContent =
    0;

  for (
    const token
    of answerContentTokens
  ) {
    if (
      sourceContentSet.has(token)
    ) {
      groundedContent++;
    }
  }

  const contentOverlapRatio =
    groundedContent /
    answerContentTokens.length;

  /* ---------------------------------------------------------------------- */
  /* 5. Require contiguous evidence                                         */
  /* ---------------------------------------------------------------------- */

  const hasTwoGram =
    hasNGramOverlap(
      answerTokens,
      sourceTokens,
      2
    );

  const hasThreeGram =
    hasNGramOverlap(
      answerTokens,
      sourceTokens,
      3
    );

  /*
   * For a short answer, require a stronger contiguous match.
   */
  if (
    answerContentTokens.length <= 3
  ) {
    if (
      contentOverlapRatio >=
        minContentRatio &&
      hasTwoGram
    ) {
      return {
        passed: true,
        status: 'PASSED',
        confidence:
          Math.min(
            0.98,
            0.65 *
              contentOverlapRatio +
              0.35 *
                tokenOverlapRatio
          ),
      };
    }
  }

  /*
   * For longer extractive answers:
   *
   * high content overlap + at least a phrase from the
   * source is enough.
   */
  if (
    contentOverlapRatio >=
      minContentRatio &&
    (hasTwoGram ||
      hasThreeGram)
  ) {
    return {
      passed: true,
      status: 'PASSED',
      confidence:
        Math.min(
          0.98,
          0.60 *
            contentOverlapRatio +
            0.40 *
              tokenOverlapRatio
        ),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* 6. Fail                                                               */
  /* ---------------------------------------------------------------------- */

  return {
    passed: false,
    status:
      'GROUNDING_FAILED',
    reason:
      `Answer grounding failed. Token overlap ${Math.round(
        tokenOverlapRatio * 100
      )}%, content overlap ${Math.round(
        contentOverlapRatio * 100
      )}%, required token overlap ${Math.round(
        minTokenRatio * 100
      )}%.`,
    confidence:
      Math.min(
        1,
        0.55 *
          tokenOverlapRatio +
          0.45 *
            contentOverlapRatio
      ),
  };
}