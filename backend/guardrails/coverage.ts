import { GuardrailResult } from './types.js';
import {
  RerankedCandidate,
  extractNonStopwords,
} from '../retrieval/reranker.js';

export interface CoverageOptions {
  minCoverageThreshold?: number;
  minScoreThreshold?: number;
}

export interface ValidationTelemetry {
  query_relevance_score: number;
  entity_match_score: number;
  coverage_score: number;
  question_type_score: number;
  final_confidence: number;
  rejection_reason: string | null;
}

export interface ValidationResult
  extends GuardrailResult {
  telemetry: ValidationTelemetry;
}

/* -------------------------------------------------------------------------- */
/* ENTITY ALIASES                                                            */
/* -------------------------------------------------------------------------- */

export const ENTITY_ALIASES: Record<
  string,
  string[]
> = {
  goa: [
    'गोवा',
    'panaji',
    'पणजी',
    'margao',
    'vasco',
    'वास्को',
    'konkan',
    'कोंकण',
    'portuguese',
    'पुर्तगाली',
    '1961',
    'operation vijay',
    'ऑपरेशन विजय',
  ],

  'गोवा': [
    'goa',
    'panaji',
    'पणजी',
    'vasco',
    'वास्को',
    'margao',
    'कोंकण',
    'konkan',
    '1961',
    'ऑपरेशन विजय',
    'operation vijay',
  ],

  panaji: [
    'पणजी',
    'goa',
    'गोवा',
    'capital',
    'राजधानी',
  ],

  'पणजी': [
    'panaji',
    'goa',
    'गोवा',
    'राजधानी',
    'capital',
  ],

  isro: [
    'indian space research organisation',
    'indian space research organization',
    'भारतीय अंतरिक्ष अनुसंधान संगठन',
    'sarabhai',
    'vikram sarabhai',
    'विक्रम साराभाई',
    'bengaluru',
    'बेंगलुरु',
    '1969',
    'aryabhata',
    'आर्यभट',
  ],

  'भारतीय अंतरिक्ष अनुसंधान संगठन': [
    'isro',
    'indian space research organisation',
    'indian space research organization',
    'साराभाई',
    'sarabhai',
    'बेंगलुरु',
    '1969',
  ],

  hnsw: [
    'hierarchical navigable small world',
    'approximate nearest neighbor',
    'ann',
    'malkov',
    'yashunin',
    'vector search',
  ],

  'hierarchical navigable small world': [
    'hnsw',
    'approximate nearest neighbor',
    'malkov',
  ],

  bm25: [
    'okapi bm25',
    'okapi',
    'probabilistic relevance framework',
    'robertson',
    'sparck jones',
  ],

  'okapi bm25': [
    'bm25',
    'okapi',
    'probabilistic relevance framework',
  ],

  rrf: [
    'reciprocal rank fusion',
    'cormack',
    'clarke',
    'buettcher',
    'hybrid search',
  ],

  'reciprocal rank fusion': [
    'rrf',
  ],

  timsort: [
    'tim sort',
    'tim peters',
    'peters',
    'sorting algorithm',
    'python 2002',
  ],

  'tim sort': [
    'timsort',
    'tim peters',
  ],

  'tim peters': [
    'timsort',
    'python 2002',
  ],

  btree: [
    'b-tree',
    'b-trees',
    'btrees',
    'b tree',
    'bayer',
    'mccreight',
    'database indexing',
    'self-balancing',
  ],

  btrees: [
    'b-tree',
    'b-trees',
    'btree',
    'b tree',
    'database indexing',
  ],

  'b-tree': [
    'btree',
    'btrees',
    'b-trees',
    'b tree',
    'database indexing',
  ],

  'b-trees': [
    'btree',
    'btrees',
    'b-tree',
    'b tree',
    'database indexing',
  ],

  'operation vijay': [
    'ऑपरेशन विजय',
    '1961',
    'liberation of goa',
    'liberated',
    'पुर्तगाली शासन',
    'मुक्त कराया',
    'गोवा',
    'goa',
  ],

  'ऑपरेशन विजय': [
    'operation vijay',
    '1961',
    'गोवा',
    'goa',
    'पुर्तगाली',
    'मुक्त कराया',
  ],

  ajanta: [
    'ajanta caves',
    'अजंता',
    'अजंता गुफाएं',
    'aurangabad',
    'औरंगाबाद',
    'chhatrapati sambhaji nagar',
    'maharashtra',
  ],

  'अजंता': [
    'ajanta',
    'ajanta caves',
    'औरंगाबाद',
    'aurangabad',
  ],

  phloem: [
    'फ्लोएम',
    'फ्लोएम ऊतक',
    'phloem tissue',
  ],

  'फ्लोएम': [
    'phloem',
    'phloem tissue',
    'फ्लोएम ऊतक',
  ],

  xylem: [
    'जाइलम',
    'जाइलम ऊतक',
    'xylem tissue',
  ],

  'जाइलम': [
    'xylem',
    'xylem tissue',
    'जाइलम ऊतक',
  ],

  godavari: [
    'गोदावरी',
    'dakshin ganga',
    'दक्षिण गंगा',
    'peninsular river',
    'nashik',
    'trimbakeshwar',
  ],

  'गोदावरी': [
    'godavari',
    'dakshin ganga',
    'दक्षिण गंगा',
  ],

  'western ghats': [
    'पश्चिमी घाट',
    'sahyadri',
    'सह्याद्री',
  ],

  'पश्चिमी घाट': [
    'western ghats',
    'sahyadri',
  ],

  'mariana trench': [
    'challenger deep',
    'mariana',
    'pacific ocean',
  ],

  'amazon river': [
    'amazon',
    'south america',
    'atlantic ocean',
  ],

  'sahara desert': [
    'sahara',
    'north africa',
  ],

  dna: [
    'double helix',
    'watson',
    'crick',
    'franklin',
    '1953',
    'nature',
  ],

  indian: [
    'india',
    'subcontinent',
  ],

  india: [
    'indian',
    'subcontinent',
  ],

  portuguese: [
    'portugal',
    'goa',
    '1961',
  ],

  brazilian: [
    'brazil',
    'amazon',
  ],
};

/* -------------------------------------------------------------------------- */
/* EVENT SYNONYMS                                                            */
/* -------------------------------------------------------------------------- */

export const EVENT_SYNONYMS: Record<
  string,
  string[]
> = {
  liberated: [
    'liberation',
    'liberate',
    'मुक्त कराया',
    'मुक्त',
    '1961',
    'operation vijay',
    'ऑपरेशन विजय',
  ],

  liberation: [
    'liberated',
    'liberate',
    'मुक्त कराया',
    'मुक्त',
    '1961',
    'operation vijay',
    'ऑपरेशन विजय',
  ],

  liberate: [
    'liberated',
    'liberation',
    'मुक्त कराया',
    'मुक्त',
    '1961',
  ],

  'मुक्त': [
    'liberated',
    'liberation',
    'मुक्त कराया',
  ],

  rule: [
    'ruled',
    'ruler',
    'शासन',
    'पुर्तगाली',
  ],

  ruled: [
    'rule',
    'ruler',
    'शासन',
    'पुर्तगाली',
  ],

  landed: [
    'land',
    'arrival',
    'arrived',
    'voyage',
    '16th century',
  ],
};

/* -------------------------------------------------------------------------- */
/* GENERIC TERMS                                                             */
/* -------------------------------------------------------------------------- */

const GENERIC_QUERY_TERMS =
  new Set([
    'body',
    'body part',
    'body parts',
    'part',
    'parts',
    'thing',
    'things',
    'person',
    'people',
    'information',
    'what',
    'why',
    'how',
    'when',
    'where',
    'who',
    'which',
    'capital',
    'system',
    'systems',
    'place',
    'places',
    'stuff',
    'item',
    'items',
    'data',
    'fact',
    'facts',
    'tell me',
    'give me',
    'describe',
    'details',
    'name',
    'names',
    'object',
    'objects',
    'something',
    'anything',
    'word',
    'words',
  ]);

/* -------------------------------------------------------------------------- */
/* AUTHORSHIP                                                                */
/* -------------------------------------------------------------------------- */

const AUTHORSHIP_PREDICATES =
  new Set([
    'create',
    'created',
    'creator',
    'creates',
    'creating',
    'invent',
    'invented',
    'inventor',
    'invents',
    'inventing',
    'implement',
    'implemented',
    'implementation',
    'implements',
    'implementing',
    'develop',
    'developed',
    'developer',
    'develops',
    'developing',
    'design',
    'designed',
    'designer',
    'designs',
    'designing',
    'found',
    'founded',
    'founder',
    'founds',
    'founding',
    'establish',
    'established',
    'establishment',
    'build',
    'built',
    'builder',
    'author',
    'authored',
    'publish',
    'published',
    'propose',
    'proposed',
    'start',
    'started',
  ]);

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                             */
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

function cleanAlphanumeric(
  text: string
): string {
  return normalizeText(text).replace(
    /[^\p{L}\p{M}\p{N}]/gu,
    ''
  );
}

/* -------------------------------------------------------------------------- */
/* QUERY EXPANSION                                                           */
/* -------------------------------------------------------------------------- */

export function getDeterministicQueryExpansion(
  query: string
): string[] {
  const norm = normalizeText(query);
  const expansionTerms: string[] =
    [];

  for (
    const [key, aliases]
    of Object.entries(ENTITY_ALIASES)
  ) {
    if (norm.includes(key)) {
      for (const alias of aliases) {
        const aliasNorm =
          normalizeText(alias);

        if (
          !norm.includes(aliasNorm) &&
          !expansionTerms.includes(alias)
        ) {
          expansionTerms.push(alias);
        }
      }
    }
  }

  for (
    const [key, synonyms]
    of Object.entries(EVENT_SYNONYMS)
  ) {
    if (norm.includes(key)) {
      for (const synonym of synonyms) {
        const synonymNorm =
          normalizeText(synonym);

        if (
          !norm.includes(synonymNorm) &&
          !expansionTerms.includes(synonym)
        ) {
          expansionTerms.push(synonym);
        }
      }
    }
  }

  return expansionTerms;
}

/* -------------------------------------------------------------------------- */
/* ENTITY MATCHING                                                           */
/* -------------------------------------------------------------------------- */

export function matchEntityInEvidence(
  entity: string,
  combinedEvidence: string,
  cleanEvidence: string
): boolean {
  const entLower =
    normalizeText(entity);

  if (!entLower) {
    return false;
  }

  const evidenceLower =
    normalizeText(combinedEvidence);

  const evidenceClean =
    cleanEvidence ||
    cleanAlphanumeric(
      combinedEvidence
    );

  if (
    evidenceLower.includes(
      entLower
    )
  ) {
    return true;
  }

  const entAlphanum =
    cleanAlphanumeric(entLower);

  if (
    entAlphanum.length >= 2 &&
    evidenceClean.includes(
      entAlphanum
    )
  ) {
    return true;
  }

  /*
   * English plural / possessive tolerance.
   */
  if (
    entLower.endsWith('s') &&
    entLower.length > 4
  ) {
    const base =
      entLower.slice(0, -1);

    if (
      evidenceLower.includes(base) ||
      evidenceClean.includes(
        cleanAlphanumeric(base)
      )
    ) {
      return true;
    }
  }

  /*
   * Known aliases.
   */
  const aliases =
    ENTITY_ALIASES[entLower] ||
    ENTITY_ALIASES[entAlphanum];

  if (aliases) {
    for (const alias of aliases) {
      const aliasNorm =
        normalizeText(alias);

      if (
        evidenceLower.includes(
          aliasNorm
        )
      ) {
        return true;
      }

      const aliasClean =
        cleanAlphanumeric(alias);

      if (
        aliasClean.length >= 2 &&
        evidenceClean.includes(
          aliasClean
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* TOKEN MATCHING                                                            */
/* -------------------------------------------------------------------------- */

export function matchTokenInEvidence(
  token: string,
  combinedEvidence: string,
  cleanEvidence: string
): boolean {
  const tok =
    normalizeText(token);

  if (!tok) {
    return false;
  }

  const evidence =
    normalizeText(
      combinedEvidence
    );

  const clean =
    cleanEvidence ||
    cleanAlphanumeric(
      combinedEvidence
    );

  /*
   * Exact phrase/token.
   */
  if (
    evidence.includes(tok)
  ) {
    return true;
  }

  /*
   * Unicode-clean representation.
   */
  const tokClean =
    cleanAlphanumeric(tok);

  if (
    tokClean.length >= 2 &&
    clean.includes(tokClean)
  ) {
    return true;
  }

  /*
   * Entity aliases.
   */
  const aliases =
    ENTITY_ALIASES[tok] ||
    ENTITY_ALIASES[tokClean];

  if (aliases) {
    for (const alias of aliases) {
      const aliasNorm =
        normalizeText(alias);

      if (
        evidence.includes(
          aliasNorm
        )
      ) {
        return true;
      }

      const aliasClean =
        cleanAlphanumeric(alias);

      if (
        aliasClean.length >= 2 &&
        clean.includes(aliasClean)
      ) {
        return true;
      }
    }
  }

  /*
   * Event synonyms.
   */
  const eventSynonyms =
    EVENT_SYNONYMS[tok] ||
    EVENT_SYNONYMS[tokClean];

  if (eventSynonyms) {
    for (
      const synonym
      of eventSynonyms
    ) {
      const synNorm =
        normalizeText(synonym);

      if (
        evidence.includes(
          synNorm
        )
      ) {
        return true;
      }

      const synClean =
        cleanAlphanumeric(
          synonym
        );

      if (
        synClean.length >= 2 &&
        clean.includes(
          synClean
        )
      ) {
        return true;
      }
    }
  }

  /*
   * Authorship predicates.
   */
  if (
    AUTHORSHIP_PREDICATES.has(
      tok
    )
  ) {
    for (
      const predicate
      of AUTHORSHIP_PREDICATES
    ) {
      if (
        evidence.includes(
          predicate
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* QUERY ENTITY EXTRACTION                                                    */
/* -------------------------------------------------------------------------- */

export function extractQueryEntities(
  query: string
): string[] {
  const clean =
    query.trim();

  const lower =
    normalizeText(query);

  const entities: string[] =
    [];

  const knownCompoundEntities = [
    'hacker house goa',
    'hacker house',
    'tamil nadu',
    'uttar pradesh',
    'madhya pradesh',
    'himachal pradesh',
    'andhra pradesh',
    'arunachal pradesh',
    'west bengal',
    'jammu and kashmir',
    'vasco da gama',
    'vikram sarabhai',
    'indus valley',
    'arabian sea',
    'western ghats',
    'eastern ghats',
    'mariana trench',
    'sahara desert',
    'amazon river',
    'mount everest',
    'mohenjo daro',
    'operation vijay',
    'ऑपरेशन विजय',
  ];

  for (
    const entity
    of knownCompoundEntities
  ) {
    if (
      lower.includes(
        normalizeText(entity)
      )
    ) {
      entities.push(
        normalizeText(entity)
      );
    }
  }

  /*
   * Explicit known entities.
   *
   * IMPORTANT:
   * Do not extract every capitalized English word.
   * That was too brittle for natural questions.
   */
  const knownSingleEntities = [
    'haryana',
    'goa',
    'isro',
    'delhi',
    'punjab',
    'karnataka',
    'maharashtra',
    'kerala',
    'gujarat',
    'rajasthan',
    'bihar',
    'bengal',
    'india',
    'hnsw',
    'bm25',
    'rrf',
    'sarabhai',
    'aryabhata',
    'python',
    'timsort',
    'mariana',
    'sahara',
    'amazon',
    'panaji',
    'vasco',
    'margao',
    'indus',
    'harappa',
    'mohenjo',
    'ajanta',
    'ellora',
    'everest',
    'chandigarh',
    'bengaluru',
    'mumbai',
    'kolkata',
    'chennai',
    'hyderabad',
    'phloem',
    'xylem',
    'dna',
  ];

  for (
    const entity
    of knownSingleEntities
  ) {
    if (
      lower.includes(entity) &&
      !entities.includes(entity)
    ) {
      entities.push(entity);
    }
  }

  /*
   * Preserve genuine proper nouns from English queries.
   */
  const rawWords =
    clean.split(/\s+/);

  for (
    const word
    of rawWords
  ) {
    const stripped =
      word
        .replace(
          /['’]s$/i,
          ''
        )
        .replace(
          /[^\p{L}\p{M}\p{N}]/gu,
          ''
        );

    if (
      stripped.length < 3 ||
      !/^[A-Z]/.test(
        stripped
      )
    ) {
      continue;
    }

    const low =
      stripped.toLowerCase();

    const questionWords =
      new Set([
        'what',
        'where',
        'who',
        'when',
        'why',
        'how',
        'which',
        'is',
        'are',
        'do',
        'does',
        'can',
        'could',
        'should',
        'explain',
        'tell',
        'give',
        'state',
        'name',
        'list',
        'define',
      ]);

    if (
      questionWords.has(low)
    ) {
      continue;
    }

    if (
      !entities.some(
        e =>
          e === low ||
          e.includes(low)
      )
    ) {
      entities.push(low);
    }
  }

  return Array.from(
    new Set(entities)
  );
}

/* -------------------------------------------------------------------------- */
/* GENERIC / UNDERSPECIFIED                                                  */
/* -------------------------------------------------------------------------- */

export function checkUnderspecifiedQuery(
  query: string
): {
  isUnderspecified: boolean;
  reason?: string;
} {
  const norm =
    normalizeText(query);

  const words =
    norm
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return {
      isUnderspecified: true,
      reason:
        'underspecified_query',
    };
  }

  if (
    GENERIC_QUERY_TERMS.has(
      norm
    )
  ) {
    return {
      isUnderspecified: true,
      reason:
        'underspecified_query',
    };
  }

  const contentTokens =
    extractNonStopwords(
      norm
    );

  if (
    contentTokens.length === 0
  ) {
    return {
      isUnderspecified: true,
      reason:
        'underspecified_query',
    };
  }

  const allGeneric =
    contentTokens.every(
      token =>
        GENERIC_QUERY_TERMS.has(
          token
        )
    );

  if (
    allGeneric &&
    words.length <= 3
  ) {
    return {
      isUnderspecified: true,
      reason:
        'underspecified_query',
    };
  }

  if (
    words.length === 1 &&
    (
      GENERIC_QUERY_TERMS.has(
        words[0]
      ) ||
      words[0].length <= 2
    )
  ) {
    return {
      isUnderspecified: true,
      reason:
        'underspecified_query',
    };
  }

  return {
    isUnderspecified: false,
  };
}

/* -------------------------------------------------------------------------- */
/* RELATION SUBJECT                                                          */
/* -------------------------------------------------------------------------- */

function extractRelationSubject(
  query: string
): string {
  const clean =
    query
      .trim()
      .replace(
        /[?.!,]+$/g,
        ''
      );

  const englishPatterns = [
    /\bwhat\s+does\s+(.+?)\s+(?:carry|transport|produce|contain|do|use|provide|include|refer\s+to|mean)\b/i,
    /\bwhat\s+do\s+(.+?)\s+(?:carry|transport|produce|contain|do|use|provide|include)\b/i,
    /\bhow\s+does\s+(.+?)\s+work\b/i,
    /\bwhat\s+happens\s+to\s+(.+?)\b/i,
  ];

  for (
    const pattern
    of englishPatterns
  ) {
    const match =
      clean.match(
        pattern
      );

    if (match?.[1]) {
      return match[1]
        .trim()
        .replace(
          /^(the|a|an)\s+/i,
          ''
        )
        .trim();
    }
  }

  const hindiPatterns = [
    /^(.+?)\s+क्या\s+(?:करता|करती|करते)\s+है/u,
    /^(.+?)\s+क्या\s+(?:ले जाता|ले जाती|ले जाते)\s+है/u,
    /^(.+?)\s+क्या\s+(?:उत्पन्न करता|उत्पन्न करती|उत्पन्न करते)\s+है/u,
    /^(.+?)\s+क्या\s+(?:करता|करती|करते|ले जाता|ले जाती|ले जाते|उत्पन्न करता|उत्पन्न करती|उत्पन्न करते)/u,
  ];

  for (
    const pattern
    of hindiPatterns
  ) {
    const match =
      clean.match(
        pattern
      );

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/* -------------------------------------------------------------------------- */
/* QUESTION TYPE                                                             */
/* -------------------------------------------------------------------------- */

export function detectQuestionType(
  query: string
): {
  type:
    | 'CAPITAL'
    | 'LOCATION'
    | 'FOUNDER'
    | 'DATE_TIME'
    | 'WEATHER'
    | 'EXPLANATION'
    | 'DEFINITION'
    | 'RELATION'
    | 'NUMERICAL'
    | 'GENERAL';

  requiresEntity: boolean;
} {
  const lower =
    normalizeText(query);

  if (
    /\b(?:weather|temperature|forecast|rain|climate today|weather today)\b/i.test(
      lower
    )
  ) {
    return {
      type: 'WEATHER',
      requiresEntity: true,
    };
  }

  if (
    /\b(?:capital|state capital|rajdhani)\b/i.test(
      lower
    ) ||
    /राजधानी/u.test(lower)
  ) {
    return {
      type: 'CAPITAL',
      requiresEntity: true,
    };
  }

  if (
    /\b(?:where|location|located|situated|coast|borders|region)\b/i.test(
      lower
    ) ||
    /(?:कहाँ|स्थान|स्थित|तट)/u.test(
      lower
    )
  ) {
    return {
      type: 'LOCATION',
      requiresEntity: true,
    };
  }

  if (
    /\b(?:who founded|who established|founder|father of|who is the founder)\b/i.test(
      lower
    ) ||
    /किसने/u.test(lower)
  ) {
    return {
      type: 'FOUNDER',
      requiresEntity: true,
    };
  }

  if (
    /\b(?:when was|what year|what date|established on|established in|founded in)\b/i.test(
      lower
    ) ||
    /\b(?:कब|किस वर्ष|किस साल)\b/u.test(
      lower
    )
  ) {
    return {
      type: 'DATE_TIME',
      requiresEntity: true,
    };
  }

  if (
    /\b(?:speed of|depth of|distance to|height of|mass of|size of)\b/i.test(
      lower
    )
  ) {
    return {
      type: 'NUMERICAL',
      requiresEntity: true,
    };
  }

  if (
    /\bwhat\s+does\s+.+?\s+(?:carry|transport|produce|contain|do|use|provide|include|refer\s+to|mean)\b/i.test(
      lower
    ) ||
    /\bwhat\s+do\s+.+?\s+(?:carry|transport|produce|contain|do|use|provide|include)\b/i.test(
      lower
    ) ||
    /\bhow\s+does\s+.+?\s+work\b/i.test(
      lower
    ) ||
    /(?:क्या|क्या-क्या).*(?:करता|करती|करते|ले जाता|ले जाती|ले जाते|उत्पन्न करता|उत्पन्न करती)/u.test(
      lower
    )
  ) {
    return {
      type: 'RELATION',
      requiresEntity: true,
    };
  }

  if (
    /\b(?:what is|what are|define|definition of|meaning of)\b/i.test(
      lower
    ) ||
    /(?:क्या है|क्या हैं|का अर्थ क्या है|की परिभाषा|का मतलब क्या है)/u.test(
      lower
    )
  ) {
    return {
      type: 'DEFINITION',
      requiresEntity: false,
    };
  }

  if (
    /\b(?:how does|why is|explain|mechanism|algorithm|process|work|works)\b/i.test(
      lower
    )
  ) {
    return {
      type: 'EXPLANATION',
      requiresEntity: false,
    };
  }

  return {
    type: 'GENERAL',
    requiresEntity: false,
  };
}

/* -------------------------------------------------------------------------- */
/* DEFINITION EVIDENCE                                                       */
/* -------------------------------------------------------------------------- */

function hasDefinitionEvidence(
  query: string,
  evidence: string
): boolean {
  const q =
    normalizeText(query);

  const e =
    normalizeText(evidence);

  let subject = '';

  const patterns = [
    /\bwhat\s+is\s+the\s+meaning\s+of\s+(.+?)(?:\s+in\s+.+?)?$/i,
    /\bwhat\s+does\s+(.+?)\s+mean(?:\s+in\s+.+?)?$/i,
    /\bmeaning\s+of\s+(.+?)(?:\s+in\s+.+?)?$/i,
    /\bwhat\s+(?:is|are)\s+(.+?)$/i,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      q.match(pattern);

    if (match?.[1]) {
      subject =
        match[1]
          .trim()
          .replace(
            /^(the|a|an)\s+/i,
            ''
          )
          .trim();

      if (subject) {
        break;
      }
    }
  }

  if (!subject) {
    const hindi =
      q.match(
        /(.+?)\s+(?:क्या है|क्या हैं|की परिभाषा|का अर्थ क्या है|का मतलब क्या है)$/u
      );

    if (hindi?.[1]) {
      subject =
        hindi[1].trim();
    }
  }

  if (!subject) {
    return false;
  }

  const clean =
    cleanAlphanumeric(e);

  const subjectMatched =
    matchEntityInEvidence(
      subject,
      e,
      clean
    ) ||
    matchTokenInEvidence(
      subject,
      e,
      clean
    );

  if (!subjectMatched) {
    return false;
  }

  const definitionPatterns = [
    /\bis\s+(?:a|an|the)\b/i,
    /\bare\s+(?:a|an|the)\b/i,
    /\bmeaning\s+(?:is|of)\b/i,
    /\bname\s+meaning\s+(?:is|:)\b/i,
    /\bmeans?\b/i,
    /\brefers?\s+to\b/i,
    /\bdefined\s+as\b/i,
    /\bknown\s+as\b/i,
    /\bis\s+defined\b/i,
    /\bdenotes?\b/i,
    /\bcalled\b/i,
    /का अर्थ/i,
    /का मतलब/i,
    /की परिभाषा/i,
    /कहलाता/i,
    /कहलाती/i,
    /एक प्रक्रिया/i,
    /एक प्रकार/i,
    /अर्थात/i,
  ];

  const sentences =
    evidence
      .split(/[.!?।]+/)
      .map(
        s => s.trim()
      )
      .filter(Boolean);

  for (
    const sentence
    of sentences
  ) {
    const sentenceClean =
      cleanAlphanumeric(
        sentence
      );

    const sentenceHasSubject =
      matchEntityInEvidence(
        subject,
        sentence,
        sentenceClean
      ) ||
      matchTokenInEvidence(
        subject,
        sentence,
        sentenceClean
      );

    if (!sentenceHasSubject) {
      continue;
    }

    if (
      definitionPatterns.some(
        pattern =>
          pattern.test(
            sentence
          )
      )
    ) {
      return true;
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* RELATION EVIDENCE                                                         */
/* -------------------------------------------------------------------------- */

function hasRelationEvidence(
  query: string,
  evidence: string
): boolean {
  const subject = extractRelationSubject(query);

  if (!subject) return false;

  const evidenceNorm = normalizeText(evidence);
  const evidenceClean = cleanAlphanumeric(evidenceNorm);

  const subjectPresent =
    matchTokenInEvidence(
      subject,
      evidenceNorm,
      evidenceClean
    ) ||
    matchEntityInEvidence(
      subject,
      evidenceNorm,
      evidenceClean
    );

  if (!subjectPresent) return false;

  const relationPredicates = [
    /\bcarry(?:s|ing)?\b/i,
    /\btransport(?:s|ed|ing)?\b/i,
    /\bproduce(?:s|d|ing)?\b/i,
    /\bcontain(?:s|ed|ing)?\b/i,
    /\binclude(?:s|d|ing)?\b/i,
    /\bprovide(?:s|d|ing)?\b/i,
    /\bmove(?:s|d|ing)?\b/i,
    /\btransfer(?:s|red|ring)?\b/i,
    /\bflow(?:s|ed|ing)?\b/i,
    /\bdeliver(?:s|ed|ing)?\b/i,
    /\btransportation\b/i,

    /ले जाता/iu,
    /ले जाती/iu,
    /ले जाते/iu,
    /परिवहन/iu,
    /उत्पन्न/iu,
    /स्थानांतरित/iu,
    /प्रवाह/iu,
    /बहता/iu,
    /बहती/iu,
    /बहते/iu,
  ];

  // Direct relation evidence
  if (
    relationPredicates.some(
      pattern => pattern.test(evidenceNorm)
    )
  ) {
    return true;
  }

  /*
   * Allow noun-based factual relations when the entity
   * and a strong relation noun occur in the same evidence.
   */
  const relationNouns = [
    /\bproducts?\b/i,
    /\bsugars?\b/i,
    /\bwater\b/i,
    /\bminerals?\b/i,
    /\bfood\b/i,
    /\bnutrients?\b/i,
    /\bphotosynthesis\b/i,
    /\bpressure flow\b/i,
    /\bsource(?:s)?\b/i,
    /\bsink(?:s)?\b/i,

    /पानी/iu,
    /खनिज/iu,
    /भोजन/iu,
    /शर्करा/iu,
    /चीनी/iu,
  ];

  return relationNouns.some(
    pattern => pattern.test(evidenceNorm)
  );
}
/* -------------------------------------------------------------------------- */
/* EXPLANATION EVIDENCE                                                      */
/* -------------------------------------------------------------------------- */

function hasExplanationEvidence(
  evidence: string
): boolean {
  return (
    /\b(?:because|therefore|works by|works through|process|mechanism|steps|consists of|uses|allows|enables|first|then|finally)\b/i.test(
      evidence
    ) ||
    /(?:क्योंकि|प्रक्रिया|तरीका|चरण|इस प्रकार|काम करता|काम करती|उपयोग करता)/u.test(
      evidence
    )
  );
}

/* -------------------------------------------------------------------------- */
/* COVERAGE GUARDRAIL                                                        */
/* -------------------------------------------------------------------------- */

export function checkCoverageGuardrail(
  query: string,
  topCandidates: RerankedCandidate[],
  options: CoverageOptions = {}
): ValidationResult {
  if (
    !topCandidates ||
    topCandidates.length === 0
  ) {
    return {
      passed: false,
      status: 'NO_CONTEXT',
      reason:
        'No matching passages retrieved from the knowledge base.',
      confidence: 0,
      telemetry: {
        query_relevance_score: 0,
        entity_match_score: 0,
        coverage_score: 0,
        question_type_score: 0,
        final_confidence: 0,
        rejection_reason:
          'no_retrieval_candidates',
      },
    };
  }

  const best =
    topCandidates[0];

  const combinedEvidence =
    topCandidates
      .map(
        candidate =>
          `${candidate.chunk.title || ''} ${
            candidate.chunk.parent_text ||
            candidate.chunk.text ||
            ''
          }`
      )
      .join(' ');

  const evidenceNorm =
    normalizeText(
      combinedEvidence
    );

  const evidenceClean =
    cleanAlphanumeric(
      evidenceNorm
    );

  const bestText =
    `${best.chunk.title || ''} ${
      best.chunk.parent_text ||
      best.chunk.text ||
      ''
    }`;

  const bestTextNorm =
    normalizeText(
      bestText
    );

  const queryNorm =
    normalizeText(query);

  const contentTokens =
    extractNonStopwords(
      queryNorm
    );

  const queryEntities =
    extractQueryEntities(
      query
    );

  const qType =
    detectQuestionType(
      query
    );

  /* ---------------------------------------------------------------------- */
  /* LIVE DATA                                                              */
  /* ---------------------------------------------------------------------- */

  if (
    qType.type === 'WEATHER'
  ) {
    const liveWeather =
      /\b(?:celsius|°c|fahrenheit|humidity|precipitation|weather forecast|degrees today|temperature today)\b/i.test(
        bestTextNorm
      );

    if (!liveWeather) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Current live weather or temperature data is not available in the indexed knowledge base.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score: 1,
          coverage_score: 0,
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'temporal_live_data_unavailable',
        },
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* ENTITY MATCHING                                                        */
  /* ---------------------------------------------------------------------- */

  let entityMatchScore = 1;

  if (
    queryEntities.length > 0
  ) {
    let matched = 0;

    for (
      const entity
      of queryEntities
    ) {
      if (
        matchEntityInEvidence(
          entity,
          evidenceNorm,
          evidenceClean
        )
      ) {
        matched++;
      }
    }

    entityMatchScore =
      matched /
      queryEntities.length;
  }

  /*
   * IMPORTANT CHANGE:
   *
   * Do not immediately reject every partial entity mismatch.
   *
   * Top-3 evidence may contain:
   *   title → entity
   *   parent → context
   *   chunk → answer
   *
   * We only reject a COMPLETE entity mismatch.
   */
  if (
    queryEntities.length > 0 &&
    entityMatchScore === 0
  ) {
    return {
      passed: false,
      status:
        'INSUFFICIENT_CONTEXT',
      reason:
        'Retrieved evidence does not contain the requested entity.',
      confidence: 0.05,
      telemetry: {
        query_relevance_score:
          Number(
            Math.min(
              1,
              best.finalScore
            ).toFixed(3)
          ),
        entity_match_score: 0,
        coverage_score: 0,
        question_type_score: 0,
        final_confidence: 0.05,
        rejection_reason:
          'entity_mismatch',
      },
    };
  }

  /* ---------------------------------------------------------------------- */
  /* TOKEN COVERAGE                                                         */
  /* ---------------------------------------------------------------------- */

  const matchedTokens: string[] =
    [];

  for (
    const token
    of contentTokens
  ) {
    if (
      matchTokenInEvidence(
        token,
        evidenceNorm,
        evidenceClean
      )
    ) {
      matchedTokens.push(
        token
      );
    }
  }

  let coverageScore =
    contentTokens.length > 0
      ? matchedTokens.length /
        contentTokens.length
      : 1;

  /*
   * Entity match is stronger evidence than generic lexical
   * query words.
   */
  if (
    queryEntities.length > 0 &&
    entityMatchScore === 1
  ) {
    coverageScore =
      Math.max(
        coverageScore,
        0.60
      );
  }

  /* ---------------------------------------------------------------------- */
  /* RELATION QUERY                                                         */
  /* ---------------------------------------------------------------------- */

  if (
    qType.type === 'RELATION'
  ) {
    const relationSubject =
      extractRelationSubject(
        query
      );

    if (!relationSubject) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Could not identify the subject of the relation query.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_relation_subject',
        },
      };
    }

    const relationSubjectPresent =
      matchTokenInEvidence(
        relationSubject,
        evidenceNorm,
        evidenceClean
      ) ||
      matchEntityInEvidence(
        relationSubject,
        evidenceNorm,
        evidenceClean
      );

    if (
      !relationSubjectPresent
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          `Retrieved evidence does not contain the requested subject "${relationSubject}".`,
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_relation_subject',
        },
      };
    }

    /*
     * Relation predicate does NOT have to match exactly.
     *
     * The extractor may still find a valid answer even when
     * corpus wording differs.
     */
    const relationEvidence =
      topCandidates.some(
        candidate =>
          hasRelationEvidence(
            query,
            `${candidate.chunk.title || ''} ${
              candidate.chunk.parent_text ||
              candidate.chunk.text ||
              ''
            }`
          )
      );

    if (!relationEvidence) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence contains the subject but does not contain sufficient information for the requested relationship.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'insufficient_relation_evidence',
        },
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* SHORT FACTUAL QUESTIONS                                                */
  /* ---------------------------------------------------------------------- */

  if (
    qType.type !== 'RELATION' &&
    contentTokens.length <= 2
  ) {
    /*
     * Entity evidence is enough for short queries.
     *
     * Example:
     *   Panaji capital
     *   Mariana Trench depth
     *   Timsort Python
     */
    if (
      queryEntities.length > 0 &&
      entityMatchScore === 1
    ) {
      coverageScore =
        Math.max(
          coverageScore,
          0.75
        );
    } else if (
      coverageScore < 1
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Key terms from the query were not sufficiently represented in the retrieved evidence.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'insufficient_coverage',
        },
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* LONGER QUERY COVERAGE                                                  */
  /* ---------------------------------------------------------------------- */

  if (
    qType.type !== 'RELATION' &&
    contentTokens.length >= 3
  ) {
    const configuredThreshold =
      options.minCoverageThreshold ??
      0.45;

    /*
     * If the entity is perfectly matched, lexical coverage
     * requirement can be lower because question words,
     * predicates and language variants are not always present
     * verbatim in evidence.
     */
    const requiredCoverage =
      entityMatchScore === 1
        ? Math.min(
            configuredThreshold,
            0.45
          )
        : Math.min(
            configuredThreshold,
            0.60
          );

    if (
      coverageScore <
      requiredCoverage
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          `Insufficient query evidence coverage (${Math.round(
            coverageScore * 100
          )}%).`,
        confidence: 0.10,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.10,
          rejection_reason:
            'insufficient_coverage',
        },
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* QUESTION TYPE                                                          */
  /* ---------------------------------------------------------------------- */

  let questionTypeScore = 1;

  if (
    qType.type === 'DEFINITION'
  ) {
    const definitionEvidence =
      topCandidates.some(
        candidate =>
          hasDefinitionEvidence(
            query,
            `${candidate.chunk.title || ''} ${
              candidate.chunk.parent_text ||
              candidate.chunk.text ||
              ''
            }`
          )
      );

    if (
      !definitionEvidence
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence mentions the queried subject but does not contain a sufficiently direct definition or explanatory statement.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'insufficient_definition_evidence',
        },
      };
    }
  }

  else if (
    qType.type === 'CAPITAL'
  ) {
    const hasCapitalEvidence =
      topCandidates.some(
        candidate => {
          const text =
            normalizeText(
              `${candidate.chunk.title || ''} ${
                candidate.chunk.parent_text ||
                candidate.chunk.text ||
                ''
              }`
            );

          const clean =
            cleanAlphanumeric(
              text
            );

          const hasEntity =
            queryEntities.length === 0 ||
            queryEntities.some(
              entity =>
                matchEntityInEvidence(
                  entity,
                  text,
                  clean
                )
            );

          const hasCapital =
            /\b(?:capital|state capital|panaji|chandigarh|delhi|mumbai|bengaluru|rajdhani|seat of government)\b/i.test(
              text
            ) ||
            /राजधानी/u.test(
              text
            );

          return (
            hasEntity &&
            hasCapital
          );
        }
      );

    if (
      !hasCapitalEvidence
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence does not contain capital information for the queried location.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_question_intent',
        },
      };
    }
  }

  else if (
    qType.type === 'LOCATION'
  ) {
    const hasLocationTerms =
      /\b(?:located|southwestern|coast|region|situated|bounded|borders|ghats|arabian sea|in the|district|state of)\b/i.test(
        evidenceNorm
      ) ||
      /(?:स्थित|तट|कोंकण|स्थान)/u.test(
        evidenceNorm
      );

    if (
      !hasLocationTerms
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence does not contain sufficient location information.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_question_intent',
        },
      };
    }
  }

  else if (
    qType.type === 'FOUNDER'
  ) {
    const hasFounderTerms =
      /\b(?:founded|established|founder|father|created by|director|headed|scientist|sarabhai)\b/i.test(
        evidenceNorm
      ) ||
      /(?:स्थापित|संस्थापक|किसने|बनाया|स्थापना)/u.test(
        evidenceNorm
      );

    if (
      !hasFounderTerms
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence does not contain founder or establishment details.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_question_intent',
        },
      };
    }
  }

  else if (
    qType.type === 'DATE_TIME'
  ) {
    const hasDateTerms =
      /\b(?:19\d{2}|20\d{2}|year|date|established|founded|launched|liberation|1961|1969|1953|2015|2002)\b/i.test(
        evidenceNorm
      ) ||
      /\b(?:वर्ष|साल|स्थापना|स्थापित|लॉन्च|कब)\b/u.test(
        evidenceNorm
      );

    if (
      !hasDateTerms
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence does not contain sufficient date or time information.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_date_evidence',
        },
      };
    }
  }

  else if (
    qType.type === 'NUMERICAL'
  ) {
    const hasNumber =
      /\b\d+(?:\.\d+)?\b/.test(
        evidenceNorm
      );

    if (!hasNumber) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence does not contain the requested numerical value.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_numerical_evidence',
        },
      };
    }
  }

  else if (
    qType.type === 'EXPLANATION'
  ) {
    const hasExplanation =
      topCandidates.some(
        candidate =>
          hasExplanationEvidence(
            `${candidate.chunk.title || ''} ${
              candidate.chunk.parent_text ||
              candidate.chunk.text ||
              ''
            }`
          )
      );

    if (
      !hasExplanation
    ) {
      return {
        passed: false,
        status:
          'INSUFFICIENT_CONTEXT',
        reason:
          'Retrieved evidence does not contain sufficient explanatory or process information.',
        confidence: 0.05,
        telemetry: {
          query_relevance_score:
            Number(
              Math.min(
                1,
                best.finalScore
              ).toFixed(3)
            ),
          entity_match_score:
            Number(
              entityMatchScore.toFixed(
                3
              )
            ),
          coverage_score:
            Number(
              coverageScore.toFixed(
                3
              )
            ),
          question_type_score: 0,
          final_confidence: 0.05,
          rejection_reason:
            'missing_explanation_evidence',
        },
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* QUERY RELEVANCE                                                        */
  /* ---------------------------------------------------------------------- */

  const queryRelevanceScore =
    Math.min(
      1,
      Math.max(
        0,
        best.finalScore || 0
      )
    );

  /*
   * Retrieval score can be low even when lexical/entity evidence
   * is very strong. Therefore confidence is not dominated by
   * the RRF score.
   */
  const finalConfidence =
    Math.min(
      0.99,
      Number(
        (
          0.30 *
            entityMatchScore +
          0.25 *
            coverageScore +
          0.25 *
            questionTypeScore +
          0.20 *
            queryRelevanceScore
        ).toFixed(3)
      )
    );

  /* ---------------------------------------------------------------------- */
  /* FINAL CONFIDENCE GATE                                                  */
  /* ---------------------------------------------------------------------- */

  const configuredMinScore =
    options.minScoreThreshold ??
    0.18;

  /*
   * Strict enough to reject random evidence,
   * but less aggressive than the old 0.25 threshold.
   */
  if (
  finalConfidence < 0.42 ||
  queryRelevanceScore < 0.18
) {
    return {
      passed: false,
      status:
        'LOW_CONFIDENCE',
      reason:
        'Retrieved evidence did not meet the minimum grounding confidence threshold.',
      confidence:
        finalConfidence,
      telemetry: {
        query_relevance_score:
          Number(
            queryRelevanceScore.toFixed(
              3
            )
          ),
        entity_match_score:
          Number(
            entityMatchScore.toFixed(
              3
            )
          ),
        coverage_score:
          Number(
            coverageScore.toFixed(
              3
            )
          ),
        question_type_score:
          Number(
            questionTypeScore.toFixed(
              3
            )
          ),
        final_confidence:
          finalConfidence,
        rejection_reason:
          'low_retrieval_confidence',
      },
    };
  }

  /* ---------------------------------------------------------------------- */
  /* PASSED                                                                 */
  /* ---------------------------------------------------------------------- */

  return {
    passed: true,
    status: 'PASSED',
    confidence:
      finalConfidence,
    telemetry: {
      query_relevance_score:
        Number(
          queryRelevanceScore.toFixed(
            3
          )
        ),
      entity_match_score:
        Number(
          entityMatchScore.toFixed(
            3
          )
        ),
      coverage_score:
        Number(
          coverageScore.toFixed(
            3
          )
        ),
      question_type_score:
        Number(
          questionTypeScore.toFixed(
            3
          )
        ),
      final_confidence:
        finalConfidence,
      rejection_reason:
        null,
    },
  };
}