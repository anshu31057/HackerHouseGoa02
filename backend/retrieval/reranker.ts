import { RRFCandidate } from './rrf.js';
import { Chunk } from '../chunking/types.js';
import {
  extractQueryEntities,
  matchEntityInEvidence,
  matchTokenInEvidence,
} from '../guardrails/coverage.js';

export interface RerankedCandidate
  extends RRFCandidate {
  chunk: Chunk;
  finalScore: number;
  phraseMatchScore: number;
  coverageRatio: number;
  matchedContentTokens: string[];
  contributingStrategies?: string[];
}

/* -------------------------------------------------------------------------- */
/* STOPWORDS                                                                  */
/* -------------------------------------------------------------------------- */

const COMMON_STOPWORDS = new Set([
  // English
  'a', 'an', 'the',
  'is', 'are', 'was', 'were',
  'be', 'been', 'being',
  'am',

  'in', 'on', 'at', 'to',
  'for', 'with', 'by',
  'about', 'against',
  'between', 'into',
  'through', 'during',
  'before', 'after',
  'above', 'below',
  'from', 'up', 'down',
  'of', 'off', 'over',
  'under',

  'again', 'further',
  'then', 'once',
  'here', 'there',

  'all', 'any', 'both',
  'each', 'few', 'more',
  'most', 'other',
  'some', 'such',

  'no',
  'nor',

  /*
   * IMPORTANT:
   *
   * "not" is intentionally NOT removed.
   * Negation can change the meaning of a query.
   */
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',

  'can',
  'will',
  'just',
  'should',
  'now',

  'what',
  'which',
  'who',
  'whom',
  'whose',

  'this',
  'that',
  'these',
  'those',

  'it',
  'its',
  'they',
  'them',
  'their',
  'theirs',

  'he',
  'him',
  'his',
  'she',
  'her',
  'hers',

  'you',
  'your',
  'yours',
  'we',
  'our',
  'ours',

  'and',
  'or',
  'if',
  'because',
  'as',
  'until',
  'while',

  'does',
  'did',
  'do',
  'doing',

  'have',
  'has',
  'had',
  'having',

  'please',
  'tell',
  'explain',
  'give',
  'know',
  'find',
  'show',
  'describe',
  'detail',
  'details',
  'information',

  // Intent words
  'meaning',
  'means',
  'mean',
  'definition',
  'define',
  'function',
  'purpose',
  'reason',
  'way',
  'used',
  'use',
  'uses',
  'work',
  'works',
  'working',

  // Hindi grammar
  'क्या',
  'है',
  'हैं',
  'था',
  'थी',
  'थे',
  'हो',
  'होता',
  'होती',
  'होते',

  'और',
  'या',
  'के',
  'का',
  'की',
  'को',
  'से',
  'में',
  'पर',

  'एक',
  'यह',
  'वह',
  'ये',
  'वे',
  'इस',
  'उस',
  'इन',
  'उन',

  'लिए',

  'कैसे',
  'क्यों',
  'कौन',
  'किस',
  'किसे',
  'किसका',
  'किसकी',
  'किसके',

  'करता',
  'करती',
  'करते',
  'करना',
  'करने',
  'करें',

  'बताएं',
  'बताओ',
  'समझाएं',
  'समझाओ',

  'अर्थ',
  'मतलब',
  'परिभाषा',
  'कार्य',
  'उद्देश्य',
  'क्योंकि',
  'किसलिए',
]);

/* -------------------------------------------------------------------------- */
/* NEGATION                                                                   */
/* -------------------------------------------------------------------------- */

const NEGATION_TERMS = new Set([
  'not',
  'no',
  'never',
  'without',
  'neither',
  'nor',

  'नहीं',
  'नही',
  'न',
  'बिना',
  'कभी',
]);

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                              */
/* -------------------------------------------------------------------------- */

function normalizeText(
  text: string
): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(
      /[^\p{L}\p{M}\p{N}\s]/gu,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* TOKENIZATION                                                               */
/* -------------------------------------------------------------------------- */

export function extractNonStopwords(
  text: string
): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      token =>
        token.length >= 2 &&
        !COMMON_STOPWORDS.has(
          token
        )
    );
}

/* -------------------------------------------------------------------------- */
/* LANGUAGE                                                                   */
/* -------------------------------------------------------------------------- */

function isHindiQuery(
  text: string
): boolean {
  return /[\u0900-\u097F]/u.test(
    text
  );
}

function containsHindi(
  text: string
): boolean {
  return /[\u0900-\u097F]/u.test(
    text
  );
}

function containsLatin(
  text: string
): boolean {
  return /[a-zA-Z]/.test(
    text
  );
}

function languageCompatibility(
  query: string,
  evidence: string,
  chunkLanguage?: string
): number {
  const queryHindi =
    isHindiQuery(query);

  const evidenceHindi =
    containsHindi(evidence);

  const lang =
    (
      chunkLanguage || ''
    ).toLowerCase();

  if (queryHindi) {
    if (lang === 'hi') {
      return 1;
    }

    if (evidenceHindi) {
      return 0.95;
    }

    return 0.55;
  }

  if (lang === 'en') {
    return 1;
  }

  if (
    !evidenceHindi &&
    containsLatin(evidence)
  ) {
    return 0.95;
  }

  return 0.60;
}

/* -------------------------------------------------------------------------- */
/* EXACT TOKEN                                                                */
/* -------------------------------------------------------------------------- */

function exactTokenPresent(
  token: string,
  text: string
): boolean {
  const normalized =
    normalizeText(text);

  return new Set(
    normalized
      .split(/\s+/)
      .filter(Boolean)
  ).has(token);
}

/* -------------------------------------------------------------------------- */
/* QUERY TOKENS                                                               */
/* -------------------------------------------------------------------------- */

function getQueryTokens(
  query: string
): string[] {
  return Array.from(
    new Set(
      extractNonStopwords(
        query
      )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* NEGATION DETECTION                                                         */
/* -------------------------------------------------------------------------- */

function getQueryNegationTerms(
  query: string
): string[] {
  return getQueryTokens(
    query
  ).filter(
    token =>
      NEGATION_TERMS.has(
        token
      )
  );
}

function hasNegation(
  query: string
): boolean {
  return (
    getQueryNegationTerms(
      query
    ).length > 0
  );
}

function evidenceHasNegation(
  evidence: string
): boolean {
  const tokens =
    normalizeText(
      evidence
    )
      .split(/\s+/)
      .filter(Boolean);

  return tokens.some(
    token =>
      NEGATION_TERMS.has(
        token
      )
  );
}

/* -------------------------------------------------------------------------- */
/* SUBJECT EXTRACTION                                                         */
/* -------------------------------------------------------------------------- */

function extractSubjectCandidates(
  query: string
): string[] {
  const normalized =
    normalizeText(query);

  const tokens =
    getQueryTokens(
      normalized
    );

  if (!tokens.length) {
    return [];
  }

  const actionWords =
    new Set([
      'carry',
      'carries',
      'carried',
      'transport',
      'transports',
      'transported',
      'move',
      'moves',
      'contain',
      'contains',
      'produce',
      'produces',
      'provide',
      'provides',
      'include',
      'includes',
      'cause',
      'causes',
      'make',
      'makes',
      'mean',
      'means',
      'meaning',
      'function',
      'purpose',
      'work',
      'works',
      'working',
      'used',
      'use',
      'uses',
      'located',
      'location',
      'found',
      'founded',
      'established',

      'ले',
      'जाता',
      'जाती',
      'जाते',
      'परिवहन',
      'करता',
      'करती',
      'करते',
      'अर्थ',
      'मतलब',
      'कार्य',
      'उद्देश्य',
    ]);

  const negation =
    getQueryNegationTerms(
      query
    );

  /*
   * Negation words are semantic constraints,
   * not the subject itself.
   */
  const filtered =
    tokens.filter(
      token =>
        !actionWords.has(
          token
        ) &&
        !negation.includes(
          token
        )
    );

  /*
   * Remove generic personal pronouns / conversational
   * fragments that can appear in natural speech.
   */
  const generic =
    new Set([
      'mere',
      'mere',
      'pas',
      'main',
      'mujhe',
      'mera',
      'meri',
      'mere',
      'my',
      'me',
      'i',
      'we',
      'our',
      'hum',
      'hamare',
      'hamari',
      'hamara',
    ]);

  const finalSubjects =
    filtered.filter(
      token =>
        !generic.has(token)
    );

  return Array.from(
    new Set(
      finalSubjects
    )
  );
}

/* -------------------------------------------------------------------------- */
/* SUBJECT MATCH                                                              */
/* -------------------------------------------------------------------------- */

function subjectMatchScore(
  query: string,
  evidence: string
): number {
  const subjects =
    extractSubjectCandidates(
      query
    );

  if (!subjects.length) {
    return 0;
  }

  let matched = 0;

  for (
    const subject of subjects
  ) {
    if (
      exactTokenPresent(
        subject,
        evidence
      )
    ) {
      matched++;
      continue;
    }

    try {
      if (
        matchTokenInEvidence(
          subject,
          evidence,
          normalizeText(
            evidence
          ).replace(
            /[^\p{L}\p{M}\p{N}]/gu,
            ''
          )
        )
      ) {
        matched++;
      }
    } catch {
      // Conservative failure.
    }
  }

  return (
    matched /
    subjects.length
  );
}

/* -------------------------------------------------------------------------- */
/* ENTITY MATCH                                                               */
/* -------------------------------------------------------------------------- */

function entityMatchScore(
  query: string,
  evidence: string
): number {
  const entities =
    extractQueryEntities(
      query
    );

  if (!entities.length) {
    return 0;
  }

  let matched = 0;

  const cleanEvidence =
    normalizeText(
      evidence
    ).replace(
      /[^\p{L}\p{M}\p{N}]/gu,
      ''
    );

  for (
    const entity of entities
  ) {
    try {
      if (
        matchEntityInEvidence(
          entity,
          evidence,
          cleanEvidence
        )
      ) {
        matched++;
      }
    } catch {
      // Conservative failure.
    }
  }

  return (
    matched /
    entities.length
  );
}

/* -------------------------------------------------------------------------- */
/* RELATION QUERY                                                             */
/* -------------------------------------------------------------------------- */

function isRelationQuery(
  query: string
): boolean {
  const q =
    normalizeText(query);

  return (
    /\bwhat does\b/.test(q) ||
    /\bwhat do\b/.test(q) ||
    /\bhow does\b/.test(q) ||
    /\bhow do\b/.test(q) ||
    /\bwhat is used for\b/.test(q) ||
    /क्या.*ले जाता/.test(q) ||
    /क्या.*ले जाती/.test(q) ||
    /क्या.*करता/.test(q) ||
    /क्या.*करती/.test(q) ||
    /कैसे.*करता/.test(q) ||
    /कैसे.*करती/.test(q)
  );
}

/* -------------------------------------------------------------------------- */
/* DEFINITION QUERY                                                           */
/* -------------------------------------------------------------------------- */

function isDefinitionQuery(
  query: string
): boolean {
  const q =
    normalizeText(query);

  return (
    /^what is\b/.test(q) ||
    /^what are\b/.test(q) ||
    /^define\b/.test(q) ||
    /क्या है$/.test(q) ||
    /क्या हैं$/.test(q) ||
    /का अर्थ क्या है/.test(q) ||
    /की परिभाषा/.test(q)
  );
}

/* -------------------------------------------------------------------------- */
/* REGEX ESCAPE                                                               */
/* -------------------------------------------------------------------------- */

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

/* -------------------------------------------------------------------------- */
/* DEFINITION SCORE                                                           */
/* -------------------------------------------------------------------------- */

function definitionEvidenceScore(
  query: string,
  evidence: string
): number {
  if (
    !isDefinitionQuery(
      query
    )
  ) {
    return 0;
  }

  const subjects =
    extractSubjectCandidates(
      query
    );

  if (!subjects.length) {
    return 0;
  }

  const normalized =
    normalizeText(
      evidence
    );

  let score = 0;

  for (
    const subject of subjects
  ) {
    if (
      !exactTokenPresent(
        subject,
        normalized
      )
    ) {
      continue;
    }

    const escaped =
      escapeRegExp(
        subject
      );

    if (
      new RegExp(
        `\\b${escaped}\\s+(is|are|refers|means)\\b`,
        'i'
      ).test(normalized)
    ) {
      score += 1;
      continue;
    }

    const hindiPatterns = [
      `${subject} एक`,
      `${subject} वह`,
      `${subject} कहलाता`,
      `${subject} कहलाती`,
      `${subject} होता`,
      `${subject} होती`,
      `${subject} है`,
    ];

    if (
      hindiPatterns.some(
        pattern =>
          normalized.includes(
            pattern
          )
      )
    ) {
      score += 1;
      continue;
    }

    score += 0.45;
  }

  return Math.min(
    1,
    score /
      subjects.length
  );
}

/* -------------------------------------------------------------------------- */
/* RELATION SCORE                                                             */
/* -------------------------------------------------------------------------- */

function relationEvidenceScore(
  query: string,
  evidence: string
): number {
  if (!isRelationQuery(query)) {
    return 0;
  }

  const subjects =
    extractSubjectCandidates(query);

  if (!subjects.length) {
    return 0;
  }

  const normalized =
    normalizeText(evidence);

  const relationPatterns = [
    /\b(carry|carries|carried|transport|transports|transported|move|moves|moved|contain|contains|produce|produces|provide|provides|include|includes)\b/i,

    /\b(carry|transport|move|contain|produce|provide|include)\w*\b.*\b(water|minerals|sugar|sugars|food|nutrients|products?)\b/i,

    /\b(water|minerals|sugar|sugars|food|nutrients|products?)\b.*\b(carry|transport|move|contain|produce|provide|include)\w*\b/i,

    /ले जाता/iu,
    /ले जाती/iu,
    /ले जाते/iu,
    /परिवहन/iu,
    /उत्पन्न/iu,
    /स्थानांतरित/iu,
  ];

  let bestScore = 0;

  for (const subject of subjects) {
    const subjectIndex =
      normalized.indexOf(
        normalizeText(subject)
      );

    if (subjectIndex < 0) {
      continue;
    }

    /*
     * Only inspect a local window around the subject.
     * This prevents:
     *
     * "... water and minerals ... called xylem"
     *
     * from being treated as:
     *
     * "xylem transports water and minerals"
     */
    const windowStart =
      Math.max(0, subjectIndex - 100);

    const windowEnd =
      Math.min(
        normalized.length,
        subjectIndex +
          normalizeText(subject).length +
          140
      );

    const localWindow =
      normalized.slice(
        windowStart,
        windowEnd
      );

    if (
      relationPatterns.some(
        pattern =>
          pattern.test(localWindow)
      )
    ) {
      bestScore =
        Math.max(
          bestScore,
          0.95
        );
    }
  }

  /*
   * Do NOT give a relation score merely because the
   * subject appears somewhere in the document.
   */
  return bestScore;
}

/* -------------------------------------------------------------------------- */
/* PHRASE MATCH                                                               */
/* -------------------------------------------------------------------------- */

function calculatePhraseMatch(
  tokens: string[],
  evidence: string
): number {
  if (!tokens.length) {
    return 0;
  }

  const normalized =
    normalizeText(
      evidence
    );

  if (
    tokens.length === 1
  ) {
    return exactTokenPresent(
      tokens[0],
      normalized
    )
      ? 0.8
      : 0;
  }

  let matches = 0;
  let possible = 0;

  for (
    let i = 0;
    i <
      tokens.length - 1;
    i++
  ) {
    const a =
      tokens[i];

    const b =
      tokens[i + 1];

    if (!a || !b) {
      continue;
    }

    possible++;

    if (
      normalized.includes(
        `${a} ${b}`
      )
    ) {
      matches++;
    }
  }

  return possible
    ? Math.min(
        1,
        matches / possible
      )
    : 0;
}

/* -------------------------------------------------------------------------- */
/* NEGATION COMPATIBILITY                                                     */
/* -------------------------------------------------------------------------- */

function negationCompatibility(
  query: string,
  evidence: string
): number {
  const queryNegative =
    hasNegation(query);

  const evidenceNegative =
    evidenceHasNegation(
      evidence
    );

  /*
   * Query has no negation:
   * no penalty.
   */
  if (!queryNegative) {
    return 1;
  }

  /*
   * Query explicitly has negation.
   *
   * Evidence should ideally preserve it.
   */
  if (
    evidenceNegative
  ) {
    return 1;
  }

  /*
   * If query says "not" but evidence has only
   * positive wording, lower confidence.
   */
  return 0.25;
}

/* -------------------------------------------------------------------------- */
/* RERANK                                                                     */
/* -------------------------------------------------------------------------- */

export function rerankCandidates(
  query: string,
  candidates: RRFCandidate[],
  chunks: Chunk[],
  topK: number = 8
): RerankedCandidate[] {
  if (
    !candidates.length
  ) {
    return [];
  }

  const queryNorm =
    normalizeText(
      query
    );

  const queryTokens =
    getQueryTokens(
      queryNorm
    );

  const queryTokenSet =
    new Set(
      queryTokens
    );

  const totalTokens =
    Math.max(
      1,
      queryTokenSet.size
    );

  const subjects =
    extractSubjectCandidates(
      query
    );

  const queryEntities =
    extractQueryEntities(
      query
    );

  const queryIsNegated =
    hasNegation(
      query
    );

  /* ---------------------------------------------------------------------- */
  /* MAX RETRIEVAL SCORES                                                   */
  /* ---------------------------------------------------------------------- */

  let maxDense =
    0.0001;

  let maxBm25 =
    0.0001;

  let maxRRF =
    0.0001;

  for (
    const candidate
    of candidates
  ) {
    maxDense =
      Math.max(
        maxDense,
        candidate.denseScore ||
          0
      );

    maxBm25 =
      Math.max(
        maxBm25,
        candidate.bm25Score ||
          0
      );

    maxRRF =
      Math.max(
        maxRRF,
        candidate.rrfScore ||
          0
      );
  }

  const scored:
    RerankedCandidate[] =
    [];

  /* ---------------------------------------------------------------------- */
  /* SCORE EACH CANDIDATE                                                   */
  /* ---------------------------------------------------------------------- */

  for (
    const cand
    of candidates
  ) {
    const chunk =
      chunks[
        cand.chunkIndex
      ];

    if (!chunk) {
      continue;
    }

    const title =
      chunk.title ||
      '';

    const text =
      chunk.text ||
      '';
const parentText =
  chunk.parent_text || '';

const evidence =
  `${title} ${text} ${
    parentText.length > 1200
      ? parentText.slice(0, 1200)
      : parentText
  }`;

    const normalizedEvidence =
      normalizeText(
        evidence
      );

    /* -------------------------------------------------------------------- */
    /* TOKEN COVERAGE                                                       */
    /* -------------------------------------------------------------------- */

    const matchedTokens:
      string[] = [];

    for (
      const token
      of queryTokenSet
    ) {
      let matched =
        exactTokenPresent(
          token,
          normalizedEvidence
        );

      if (!matched) {
        try {
          matched =
            matchTokenInEvidence(
              token,
              normalizedEvidence,
              normalizedEvidence.replace(
                /[^\p{L}\p{M}\p{N}]/gu,
                ''
              )
            );
        } catch {
          matched = false;
        }
      }

      if (matched) {
        matchedTokens.push(
          token
        );
      }
    }

    /*
     * Negation is not treated as an ordinary content token.
     * It gets its own compatibility score below.
     */
    const nonNegatedMatched =
      matchedTokens.filter(
        token =>
          !NEGATION_TERMS.has(
            token
          )
      );

    const nonNegatedQueryTokens =
      queryTokens.filter(
        token =>
          !NEGATION_TERMS.has(
            token
          )
      );

    const coverageRatio =
      nonNegatedQueryTokens.length
        ? nonNegatedMatched.length /
          nonNegatedQueryTokens.length
        : 0;

    /* -------------------------------------------------------------------- */
    /* SUBJECT                                                              */
    /* -------------------------------------------------------------------- */

    const subjectScore =
      subjects.length
        ? subjectMatchScore(
            query,
            evidence
          )
        : 0;

    /* -------------------------------------------------------------------- */
    /* ENTITY                                                               */
    /* -------------------------------------------------------------------- */

    const entityScore =
      queryEntities.length
        ? entityMatchScore(
            query,
            evidence
          )
        : 0;

    /* -------------------------------------------------------------------- */
    /* LANGUAGE                                                             */
    /* -------------------------------------------------------------------- */

    const languageScore =
      languageCompatibility(
        query,
        evidence,
        String(
          (chunk as any)
            .language || ''
        ).toLowerCase()
      );

    /* -------------------------------------------------------------------- */
    /* PHRASE                                                               */
    /* -------------------------------------------------------------------- */

    const phraseMatchScore =
      calculatePhraseMatch(
        queryTokens,
        normalizedEvidence
      );

    /* -------------------------------------------------------------------- */
    /* QUESTION TYPE                                                        */
    /* -------------------------------------------------------------------- */

    const definitionScore =
      definitionEvidenceScore(
        query,
        evidence
      );

    const relationScore =
      relationEvidenceScore(
        query,
        evidence
      );

    let questionTypeBonus =
      0;

    if (isDefinitionQuery(query)) {
      questionTypeBonus =
        definitionScore * 0.22;
    } else if (isRelationQuery(query)) {
      questionTypeBonus =
        relationScore * 0.35;
    }

    /*
     * Relation queries need direct relation evidence.
     * Do not allow a generic comparison chunk to rank highly
     * merely because the subject appears somewhere in it.
     */
   

    /* -------------------------------------------------------------------- */
    /* TITLE                                                                 */
    /* -------------------------------------------------------------------- */

    const normalizedTitle =
      normalizeText(
        title
      );

    let titleMatches =
      0;

    for (
      const token
      of queryTokenSet
    ) {
      if (
        exactTokenPresent(
          token,
          normalizedTitle
        )
      ) {
        titleMatches++;
      }
    }

    const titleCoverage =
      queryTokenSet.size
        ? titleMatches /
          queryTokenSet.size
        : 0;

    const titleBonus =
      Math.min(
        0.15,
        titleCoverage *
          0.15
      );

    /* -------------------------------------------------------------------- */
    /* NEGATION                                                             */
    /* -------------------------------------------------------------------- */

    const negationScore =
      queryIsNegated
        ? negationCompatibility(
            query,
            evidence
          )
        : 1;

    /* -------------------------------------------------------------------- */
    /* RETRIEVAL NORMALIZATION                                              */
    /* -------------------------------------------------------------------- */

    const normDense =
      Math.max(
        0,
        cand.denseScore ||
          0
      ) /
      maxDense;

    const normBm25 =
      Math.max(
        0,
        cand.bm25Score ||
          0
      ) /
      maxBm25;

    const normRRF =
      Math.max(
        0,
        cand.rrfScore ||
          0
      ) /
      maxRRF;

    /* -------------------------------------------------------------------- */
    /* HARD SUBJECT PROTECTION                                              */
    /* -------------------------------------------------------------------- */

    let subjectPenalty =
      0;

    /*
     * If a query clearly contains a subject and candidate
     * contains none of it, retrieval similarity must not
     * make the candidate look relevant.
     */
    if (
      subjects.length > 0 &&
      subjectScore === 0
    ) {
      subjectPenalty =
        0.45;
    }

    /* -------------------------------------------------------------------- */
    /* ENTITY PROTECTION                                                    */
    /* -------------------------------------------------------------------- */

    let entityPenalty =
      0;

    if (
      queryEntities.length > 0 &&
      entityScore === 0
    ) {
      entityPenalty =
        0.30;
    }

    /* -------------------------------------------------------------------- */
    /* LOW-LEXICAL RELEVANCE PROTECTION                                    */
    /* -------------------------------------------------------------------- */

    let lexicalPenalty =
      0;

    if (
      subjects.length > 0 &&
      subjectScore === 0 &&
      coverageRatio < 0.25
    ) {
      lexicalPenalty =
        0.30;
    }

    /* -------------------------------------------------------------------- */
    /* COMPOSITE SCORE                                                     */
    /* -------------------------------------------------------------------- */

    let finalScore =
      /*
       * Query lexical coverage.
       */
      0.20 *
        coverageRatio +

      /*
       * Subject is the strongest signal.
       */
      0.28 *
        subjectScore +

      /*
       * Known entities.
       */
      0.14 *
        entityScore +

      /*
       * Retrieval evidence.
       */
      0.08 *
        normRRF +

      0.06 *
        normBm25 +

      0.05 *
        normDense +

      /*
       * Phrase.
       */
      0.05 *
        phraseMatchScore +

      /*
       * Same-language evidence.
       */
      0.05 *
        languageScore +

      /*
       * Query-specific evidence.
       */
      questionTypeBonus +

      /*
       * Title.
       */
      titleBonus +

      /*
       * Negation compatibility.
       */
      0.04 *
        negationScore -

      /*
       * Strong relevance penalties.
       */
      subjectPenalty -
      entityPenalty -
      lexicalPenalty;
/* -------------------------------------------------------------------- */
/* RELATION QUERY PROTECTION                                            */
/* -------------------------------------------------------------------- */

if (
  isRelationQuery(query) &&
  relationScore === 0
) {
  finalScore = Math.min(
    finalScore,
    0.12
  );
}
    /* -------------------------------------------------------------------- */
    /* NEGATED QUERY SAFETY                                                 */
    /* -------------------------------------------------------------------- */

    if (
      queryIsNegated &&
      negationScore <
        0.5
    ) {
      finalScore *=
        0.55;
    }

    /* -------------------------------------------------------------------- */
    /* ABSOLUTE RELEVANCE FLOOR                                             */
    /* -------------------------------------------------------------------- */

    /*
     * This is the key protection for:
     *
     * "मेरे पास लाइसेंस नहीं है"
     *
     * vs
     *
     * "मेटगैस ड्रायर..."
     *
     * 
     * If there is a meaningful subject but the candidate
     * contains zero subject evidence and almost no lexical
     * evidence, it cannot remain a high-ranked answer.
     */

    if (
      subjects.length > 0 &&
      subjectScore === 0 &&
      coverageRatio < 0.25 &&
      entityScore === 0
    ) {
      finalScore =
        Math.min(
          finalScore,
          0.04
        );
    }

    finalScore =
      Math.max(
        0,
        Math.min(
          1,
          finalScore
        )
      );

    scored.push({
      ...cand,
      chunk,
      finalScore,
      phraseMatchScore,
      coverageRatio,
      matchedContentTokens:
        matchedTokens,
      contributingStrategies: [
        chunk.strategy ||
          'auto',
      ],
    });
  }

  /* ---------------------------------------------------------------------- */
  /* SORT                                                                   */
  /* ---------------------------------------------------------------------- */

  scored.sort(
    (a, b) => {
      if (
        b.finalScore !==
        a.finalScore
      ) {
        return (
          b.finalScore -
          a.finalScore
        );
      }

      /*
       * Subject match tie-breaker.
       */
      const aSubject =
        subjectMatchScore(
          query,
          `${a.chunk.title || ''} ${
            a.chunk.text || ''
          } ${
            a.chunk.parent_text || ''
          }`
        );

      const bSubject =
        subjectMatchScore(
          query,
          `${b.chunk.title || ''} ${
            b.chunk.text || ''
          } ${
            b.chunk.parent_text || ''
          }`
        );

      if (
        bSubject !==
        aSubject
      ) {
        return (
          bSubject -
          aSubject
        );
      }

      /*
       * Entity match tie-breaker.
       */
      const aEntity =
        entityMatchScore(
          query,
          `${a.chunk.title || ''} ${
            a.chunk.text || ''
          } ${
            a.chunk.parent_text || ''
          }`
        );

      const bEntity =
        entityMatchScore(
          query,
          `${b.chunk.title || ''} ${
            b.chunk.text || ''
          } ${
            b.chunk.parent_text || ''
          }`
        );

      if (
        bEntity !==
        aEntity
      ) {
        return (
          bEntity -
          aEntity
        );
      }

      /*
       * Lexical coverage.
       */
      if (
        b.coverageRatio !==
        a.coverageRatio
      ) {
        return (
          b.coverageRatio -
          a.coverageRatio
        );
      }

      /*
       * BM25 tie-breaker.
       */
      return (
        (b.bm25Score || 0) -
        (a.bm25Score || 0)
      );
    }
  );

  return scored.slice(
    0,
    Math.max(
      1,
      topK
    )
  );
}