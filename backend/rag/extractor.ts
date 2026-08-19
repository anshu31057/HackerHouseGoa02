import { splitSentences } from '../chunking/sentence.js';
import { Chunk } from '../chunking/types.js';

export interface QueryRequirement {
  id: string;
  rawText: string;
  intent:
    | 'LOCATION'
    | 'CAPITAL'
    | 'FOUNDER'
    | 'TIME'
    | 'REASON'
    | 'DEFINITION'
    | 'METHOD'
    | 'RELATION'
    | 'GENERAL';
  contentTokens: string[];
  entityTokens: string[];
  keyTerms: string[];
}

export interface ExtractedAnswer {
  answer: string;
  selectedSentences: string[];
  sourceChunkId: string;
  sourcePassage: string;
  confidence: number;
  coverageRatio: number;
  requirementsCount: number;
  coveredRequirementsCount: number;
  extractedFromParent: boolean;
}

/* -------------------------------------------------------------------------- */
/* STOPWORDS                                                                  */
/* -------------------------------------------------------------------------- */

const COMMON_STOPWORDS = new Set([
  // English grammar
  'a', 'an', 'the',
  'is', 'are', 'was', 'were',
  'be', 'been', 'being',
  'am',
  'in', 'on', 'at',
  'to', 'for', 'with',
  'by', 'about', 'against',
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
  'all', 'any',
  'both', 'each',
  'few', 'more',
  'most', 'other',
  'some', 'such',
  'only', 'own',
  'same', 'so',
  'than', 'too',
  'very',

  'can', 'will',
  'just', 'should',
  'now',

  'what', 'which',
  'who', 'whom',
  'whose',

  'this', 'that',
  'these', 'those',

  'it', 'its',
  'they', 'them',
  'their', 'theirs',
  'he', 'him', 'his',
  'she', 'her', 'hers',
  'you', 'your',
  'yours',
  'me', 'my',
  'myself',
  'we', 'our',
  'ours',

  'and', 'or',
  'if', 'because',
  'as', 'until',
  'while',

  'does', 'did',
  'do',
  'having',
  'have',
  'has',

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
  'like',

  /*
   * IMPORTANT:
   *
   * "not" is intentionally NOT a stopword.
   * Negation changes meaning.
   */
]);

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                              */
/* -------------------------------------------------------------------------- */

function normalizeText(text: string): string {
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

export function extractContentTokens(
  text: string
): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 2 &&
        !COMMON_STOPWORDS.has(w)
    );
}

/* -------------------------------------------------------------------------- */
/* NEGATION                                                                   */
/* -------------------------------------------------------------------------- */

const NEGATION_WORDS = new Set([
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
  'कभी'
]);

function containsNegation(
  text: string
): boolean {
  const tokens =
    normalizeText(text)
      .split(/\s+/)
      .filter(Boolean);

  return tokens.some(
    (token) =>
      NEGATION_WORDS.has(token)
  );
}

/* -------------------------------------------------------------------------- */
/* STEM                                                                       */
/* -------------------------------------------------------------------------- */

function stemRelationWord(
  word: string
): string {
  const w =
    word.toLowerCase();

  if (
    w.endsWith('ies') &&
    w.length > 4
  ) {
    return (
      w.slice(0, -3) +
      'y'
    );
  }

  if (
    w.endsWith('ing') &&
    w.length > 5
  ) {
    return w.slice(0, -3);
  }

  if (
    w.endsWith('ied') &&
    w.length > 4
  ) {
    return (
      w.slice(0, -3) +
      'y'
    );
  }

  if (
    w.endsWith('ed') &&
    w.length > 4
  ) {
    return w.slice(0, -2);
  }

  if (
    w.endsWith('es') &&
    w.length > 4
  ) {
    return w.slice(0, -2);
  }

  if (
    w.endsWith('s') &&
    w.length > 3
  ) {
    return w.slice(0, -1);
  }

  return w;
}

/* -------------------------------------------------------------------------- */
/* SUBJECT DETECTION                                                          */
/* -------------------------------------------------------------------------- */

function extractQuestionSubjects(
  query: string
): string[] {
  const q =
    query.trim();

  const lower =
    q.toLowerCase();

  const subjects =
    new Set<string>();

  /* ---------------------------------------------------------------------- */
  /* English question patterns                                               */
  /* ---------------------------------------------------------------------- */

  const englishPatterns = [
    /\bwhat\s+is\s+(.+?)(?:\?|$)/i,

    /\bwhat\s+are\s+(.+?)(?:\?|$)/i,

    /\bwhat\s+does\s+(.+?)\s+(?:carry|carries|transport|transports|contain|contains|produce|produces|cause|causes|use|uses|include|includes|provide|provides|make|makes|move|moves|store|stores|control|controls|do|perform|performs)\b/i,

    /\bhow\s+does\s+(.+?)\s+(?:work|works|transport|transports|move|moves|function|functions)\b/i,

    /\bwhere\s+does\s+(.+?)\b/i
  ];

  for (
    const pattern of
    englishPatterns
  ) {
    const match =
      lower.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      const candidate =
        match[1]
          .trim()
          .split(/\s+/)
          .slice(0, 4)
          .join(' ');

      if (
        candidate.length >= 2
      ) {
        subjects.add(
          candidate
        );
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Hindi questions                                                         */
  /* ---------------------------------------------------------------------- */

  const hindiMatch =
    q.match(
      /^(.+?)\s+(?:क्या|कौन|कौनसा|कौन सा|कौनसी|कौन सी|कौनसे|कौन से)\b/iu
    );

  if (
    hindiMatch?.[1]
  ) {
    const candidate =
      hindiMatch[1]
        .trim();

    if (
      candidate.length >= 2
    ) {
      subjects.add(
        candidate.toLowerCase()
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Hindi relation questions                                                */
  /* ---------------------------------------------------------------------- */

  const hindiRelation =
    q.match(
      /^(.+?)\s+क्या\s+(?:ले|करता|करती|करते|परिवहन|बनाता|बनाती|रखता|रखती|उत्पन्न|करता है|करती है)/iu
    );

  if (
    hindiRelation?.[1]
  ) {
    subjects.add(
      hindiRelation[1]
        .trim()
        .toLowerCase()
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Known aliases                                                           */
  /* ---------------------------------------------------------------------- */

  const aliases:
    Record<
      string,
      string[]
    > = {
      xylem: [
        'xylem',
        'जाइलम'
      ],

      phloem: [
        'phloem',
        'फ्लोएम',
        'फ्लूम'
      ],

      dna: [
        'dna',
        'डीएनए'
      ],

      bm25: [
        'bm25'
      ],

      hnsw: [
        'hnsw'
      ],

      rrf: [
        'rrf'
      ]
    };

  for (
    const [
      canonical,
      variants
    ] of Object.entries(
      aliases
    )
  ) {
    if (
      variants.some(
        (variant) =>
          lower.includes(
            variant.toLowerCase()
          )
      )
    ) {
      subjects.add(
        canonical
      );

      for (
        const variant
        of variants
      ) {
        if (
          lower.includes(
            variant.toLowerCase()
          )
        ) {
          subjects.add(
            variant.toLowerCase()
          );
        }
      }
    }
  }

  return Array.from(
    subjects
  );
}

/* -------------------------------------------------------------------------- */
/* ENTITY-ONLY QUERY                                                          */
/* -------------------------------------------------------------------------- */

function isEntityOnlyQuery(
  query: string
): boolean {
  const normalized =
    normalizeText(query);

  if (
    !normalized
  ) {
    return false;
  }

  /*
   * Explicit questions are NOT entity-only.
   */
  const questionWords = [
    'what',
    'which',
    'who',
    'where',
    'when',
    'why',
    'how',
    'क्या',
    'कौन',
    'कहाँ',
    'कब',
    'क्यों',
    'कैसे'
  ];

  if (
    questionWords.some(
      (word) =>
        normalized.includes(
          word
        )
    )
  ) {
    return false;
  }

  /*
   * Very short query:
   *
   * "BM25"
   * "phloem"
   * "सिरियस एक्स.एम.वी."
   * "Panaji"
   */
  const tokens =
    extractContentTokens(
      normalized
    );

  return (
    tokens.length >= 1 &&
    tokens.length <= 4
  );
}

/* -------------------------------------------------------------------------- */
/* SUBJECT MATCH                                                              */
/* -------------------------------------------------------------------------- */

function subjectAppearsInSentence(
  sentence: string,
  subjects: string[]
): boolean {
  const s =
    normalizeText(
      sentence
    );

  if (
    subjects.length === 0
  ) {
    return false;
  }

  return subjects.some(
    (subject) => {
      const normalizedSubject =
        normalizeText(
          subject
        );

      if (
        !normalizedSubject
      ) {
        return false;
      }

      if (
        s.includes(
          normalizedSubject
        )
      ) {
        return true;
      }

      if (
        normalizedSubject ===
        'xylem'
      ) {
        return (
          s.includes(
            'xylem'
          ) ||
          s.includes(
            'जाइलम'
          )
        );
      }

      if (
        normalizedSubject ===
        'phloem'
      ) {
        return (
          s.includes(
            'phloem'
          ) ||
          s.includes(
            'फ्लोएम'
          ) ||
          s.includes(
            'फ्लूम'
          )
        );
      }

      return false;
    }
  );
}

/* -------------------------------------------------------------------------- */
/* WRONG KNOWN SUBJECT                                                        */
/* -------------------------------------------------------------------------- */

function sentenceContainsWrongKnownSubject(
  sentence: string,
  subjects: string[]
): boolean {
  const s =
    normalizeText(
      sentence
    );

  const asksXylem =
    subjects.some(
      (x) =>
        x === 'xylem' ||
        x === 'जाइलम'
    );

  const asksPhloem =
    subjects.some(
      (x) =>
        x === 'phloem' ||
        x === 'फ्लोएम' ||
        x === 'फ्लूम'
    );

  if (
    asksXylem &&
    !asksPhloem
  ) {
    return (
      s.includes(
        'phloem'
      ) ||
      s.includes(
        'फ्लोएम'
      ) ||
      s.includes(
        'फ्लूम'
      )
    );
  }

  if (
    asksPhloem &&
    !asksXylem
  ) {
    return (
      s.includes(
        'xylem'
      ) ||
      s.includes(
        'जाइलम'
      )
    );
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* RELATION WORDS                                                             */
/* -------------------------------------------------------------------------- */

const RELATION_WORDS = [
  'carry',
  'carries',
  'carried',
  'carrying',

  'transport',
  'transports',
  'transported',
  'transporting',

  'contain',
  'contains',

  'produce',
  'produces',

  'cause',
  'causes',

  'use',
  'uses',

  'include',
  'includes',

  'provide',
  'provides',

  'make',
  'makes',

  'move',
  'moves',

  'store',
  'stores',

  'control',
  'controls',

  'ले जाता',
  'ले जाती',
  'ले जाते',
  'लेता',
  'लेती',
  'लेते',

  'परिवहन',

  'स्थानांतरित',

  'उत्पन्न',

  'बनाता',
  'बनाती',
  'बनाते',

  'रखता',
  'रखती',
  'रखते',

  'नियंत्रित',

  'करता',
  'करती',
  'करते'
];

function hasRelationWord(
  sentence: string,
  words: string[]
): boolean {
  const normalizedSentence =
    normalizeText(
      sentence
    );

  for (
    const word of words
  ) {
    const normalizedWord =
      normalizeText(
        word
      );

    if (
      normalizedWord &&
      normalizedSentence.includes(
        normalizedWord
      )
    ) {
      return true;
    }
  }

  const tokens =
    extractContentTokens(
      sentence
    );

  for (
    const token of tokens
  ) {
    const stem =
      stemRelationWord(
        token
      );

    for (
      const word of words
    ) {
      if (
        stem ===
        stemRelationWord(
          word
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* RELATION QUESTION                                                          */
/* -------------------------------------------------------------------------- */

function isRelationQuestion(
  query: string
): boolean {
  const q =
    normalizeText(
      query
    );

  return (
    (
      /\bwhat\s+(?:does|do|did)\b/i.test(
        q
      ) ||
      /\bhow\s+does\b/i.test(
        q
      )
    ) &&
    RELATION_WORDS.some(
      (word) =>
        q.includes(
          word.toLowerCase()
        )
    )
  ) ||
    /(?:क्या|कौन सा|कौनसी|कौन से).*(?:ले जाता|ले जाती|परिवहन|उत्पन्न|बनाता|बनाती|रखता|रखती|करता|करती)/iu.test(
      q
    );
}

/* -------------------------------------------------------------------------- */
/* QUERY REQUIREMENTS                                                         */
/* -------------------------------------------------------------------------- */

export function splitQueryRequirements(
  query: string
): QueryRequirement[] {
  const cleanQuery =
    query.trim();

  const lower =
    cleanQuery.toLowerCase();

  /*
   * Entity-only query gets ONE simple GENERAL requirement.
   *
   * This is critical.
   *
   * "सिरियस एक्स.एम.वी."
   * must NOT be treated like a full question.
   */
  if (
    isEntityOnlyQuery(
      cleanQuery
    )
  ) {
    const tokens =
      extractContentTokens(
        cleanQuery
      );

    return [
      {
        id: 'req_1',
        rawText:
          cleanQuery,
        intent: 'GENERAL',
        contentTokens:
          tokens,
        entityTokens:
          tokens,
        keyTerms:
          tokens
      }
    ];
  }

  const subjects =
    extractQuestionSubjects(
      cleanQuery
    );

  const rawTokens =
    cleanQuery.split(
      /\s+/
    );

  const potentialEntities:
    string[] = [];

  for (
    const token
    of rawTokens
  ) {
    const stripped =
      token
        .replace(
          /['’]s$/i,
          ''
        )
        .replace(
          /[^\p{L}\p{M}\p{N}]/gu,
          ''
        );

    if (
      stripped.length >= 2
    ) {
      potentialEntities.push(
        stripped.toLowerCase()
      );
    }
  }

  for (
    const subject
    of subjects
  ) {
    if (
      !potentialEntities.includes(
        subject
      )
    ) {
      potentialEntities.push(
        subject
      );
    }
  }

  const domainEntities =
    cleanQuery.match(
      /\b(Goa|ISRO|HNSW|BM25|RRF|Western Ghats|Panaji|Timsort|Ajanta|Amazon|Sahara|DNA|Aryabhata|xylem|phloem)\b/gi
    ) || [];

  for (
    const entity
    of domainEntities
  ) {
    const e =
      entity.toLowerCase();

    if (
      !potentialEntities.includes(
        e
      )
    ) {
      potentialEntities.push(
        e
      );
    }
  }

  let rawClauses:
    string[] = [];

  if (
    /\b(?:where|who|what|when|why|how|which)\b.*\b(?:and|as well as|और|तथा)\b.*\b(?:where|who|what|when|why|how|which|its|their|is|are|was|were)\b/i.test(
      lower
    )
  ) {
    rawClauses =
      cleanQuery
        .split(
          /\b(?:and\s+also|and|as well as|aur|और|तथा|एवं)\b/i
        )
        .map(
          (p) =>
            p.trim()
        )
        .filter(
          (p) =>
            p.length > 2
        );
  } else if (
    cleanQuery.includes(
      '?'
    ) &&
    cleanQuery.indexOf(
      '?'
    ) <
      cleanQuery.length - 1
  ) {
    rawClauses =
      cleanQuery
        .split('?')
        .map(
          (p) =>
            p.trim()
        )
        .filter(
          (p) =>
            p.length > 2
        );
  } else {
    rawClauses = [
      cleanQuery
    ];
  }

  const requirements:
    QueryRequirement[] =
    [];

  for (
    let idx = 0;
    idx <
    rawClauses.length;
    idx++
  ) {
    const clause =
      rawClauses[idx];

    const clauseLower =
      clause.toLowerCase();

    let intent:
      QueryRequirement['intent'] =
      'GENERAL';

    if (
      isRelationQuestion(
        clause
      )
    ) {
      intent =
        'RELATION';
    } else if (
      /\b(?:capital|राजधानी)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'CAPITAL';
    } else if (
      /\b(?:where|location|located|situated|place|कहाँ|स्थान)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'LOCATION';
    } else if (
      /\b(?:who|founder|founded by|established by|creator|author|कौन|किसने)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'FOUNDER';
    } else if (
      /\b(?:when|year|date|century|कब|स्थापना)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'TIME';
    } else if (
      /\b(?:why|reason|purpose|advantage|क्यों|कारण)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'REASON';
    } else if (
      /\b(?:how|algorithm|mechanism|process|works|कैसे|कार्य)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'METHOD';
    } else if (
      /\b(?:what|definition|define|meaning|क्या|परिभाषा)\b/i.test(
        clauseLower
      )
    ) {
      intent =
        'DEFINITION';
    }

    const contentTokens =
      extractContentTokens(
        clause
      );

    const keyTerms =
      [
        ...contentTokens
      ];

    if (
      intent ===
      'CAPITAL'
    ) {
      keyTerms.push(
        'capital',
        'राजधानी'
      );
    }

    if (
      intent ===
      'LOCATION'
    ) {
      keyTerms.push(
        'located',
        'location',
        'situated',
        'region',
        'state',
        'स्थान'
      );
    }

    if (
      intent ===
      'FOUNDER'
    ) {
      keyTerms.push(
        'founded',
        'established',
        'founder'
      );
    }

    if (
      intent ===
      'TIME'
    ) {
      keyTerms.push(
        'established',
        'founded',
        'year',
        'date'
      );
    }

    if (
      intent ===
      'RELATION'
    ) {
      keyTerms.push(
        ...RELATION_WORDS
      );
    }

    requirements.push(
      {
        id:
          `req_${idx + 1}`,
        rawText:
          clause,
        intent,
        contentTokens,
        entityTokens:
          [
            ...potentialEntities,
            ...subjects
          ],
        keyTerms
      }
    );
  }

  return requirements;
}

/* -------------------------------------------------------------------------- */
/* SENTENCE SCORE                                                             */
/* -------------------------------------------------------------------------- */

export function scoreSentenceForRequirement(
  sentence: string,
  req: QueryRequirement
): number {
  const sNorm =
    normalizeText(
      sentence
    );

  const sWords =
    extractContentTokens(
      sentence
    );

  if (
    sWords.length < 2
  ) {
    return 0;
  }

  let score = 0;

  const subjects =
    req.entityTokens.filter(
      (token) =>
        token.length >= 2 &&
        !COMMON_STOPWORDS.has(
          token
        )
    );

  const hasSubject =
    subjectAppearsInSentence(
      sentence,
      subjects
    );

  const hasWrongSubject =
    sentenceContainsWrongKnownSubject(
      sentence,
      subjects
    );

  if (
    hasWrongSubject &&
    !hasSubject
  ) {
    return 0;
  }

  if (
    hasSubject
  ) {
    score += 5;
  }

  /* Content matching */

  let tokenMatches =
    0;

  for (
    const token
    of req.contentTokens
  ) {
    const stem =
      stemRelationWord(
        token
      );

    const matched =
      sWords.some(
        (sw) =>
          sw === token ||
          stemRelationWord(
            sw
          ) === stem ||
          sw.includes(
            token
          ) ||
          token.includes(
            sw
          )
      );

    if (
      matched
    ) {
      tokenMatches++;
      score += 1.2;
    }
  }

  /* Entity matching */

  for (
    const entity
    of req.entityTokens
  ) {
    const normalizedEntity =
      normalizeText(
        entity
      );

    if (
      normalizedEntity.length >= 2 &&
      sNorm.includes(
        normalizedEntity
      )
    ) {
      score += 2;
    }
  }

  /* Relation */

  if (
    req.intent ===
    'RELATION'
  ) {
    const relation =
      hasRelationWord(
        sentence,
        RELATION_WORDS
      );

    if (
      relation
    ) {
      score += 5;
    } else {
      score -= 2;
    }

    if (
      !hasSubject
    ) {
      score -= 5;
    }
  }

  /* Definition */

  if (
    req.intent ===
    'DEFINITION'
  ) {
    const definition =
      /\b(?:is a|is an|is the|is defined as|refers to|known as)\b/i.test(
        sNorm
      ) ||
      /(?:एक प्रकार|कहलाता|कहलाती|कहलाते|की परिभाषा|का अर्थ|का मतलब)/u.test(
        sNorm
      );

    if (
      definition
    ) {
      score += 3;
    }

    if (
      !hasSubject
    ) {
      score -= 4;
    }
  }

  /* Generic question */

  if (
    req.intent ===
    'GENERAL'
  ) {
    /*
     * For entity-only queries, subject/entity presence
     * is the strongest signal.
     */
    if (
      hasSubject
    ) {
      score += 4;
    }

    if (
      tokenMatches > 0
    ) {
      score +=
        tokenMatches *
        0.8;
    }
  }

  return Math.max(
    0,
    score
  );
}

/* -------------------------------------------------------------------------- */
/* EXTRACT                                                                     */
/* -------------------------------------------------------------------------- */

export function extractGroundedAnswer(
  query: string,
  topChunks: Chunk[]
): ExtractedAnswer {
  const refusal =
    "I don't have enough information in the provided knowledge base to answer that.";

  if (
    !topChunks ||
    topChunks.length === 0
  ) {
    return {
      answer: refusal,
      selectedSentences: [],
      sourceChunkId: '',
      sourcePassage: '',
      confidence: 0,
      coverageRatio: 0,
      requirementsCount: 0,
      coveredRequirementsCount: 0,
      extractedFromParent: false
    };
  }

  const requirements =
    splitQueryRequirements(
      query
    );

  const querySubjects =
    extractQuestionSubjects(
      query
    );

  const entityOnly =
    isEntityOnlyQuery(
      query
    );

  interface CandidateSentence {
    raw: string;
    normalized: string;
    chunkId: string;
    parentText: string;
    chunkText: string;
    orderIndex: number;
    chunkRank: number;
  }

  const candidates:
    CandidateSentence[] =
    [];

  const seen =
    new Set<string>();

  /*
   * Search several retrieved chunks.
   * But DO NOT allow retrieval rank to overpower
   * subject relevance.
   */
  for (
    let cIdx = 0;
    cIdx <
    Math.min(
      8,
      topChunks.length
    );
    cIdx++
  ) {
    const chunk =
      topChunks[cIdx];

    const passage =
      chunk.parent_text &&
      chunk.parent_text.length >
        chunk.text.length
        ? chunk.parent_text
        : chunk.text;

    const sentences =
      splitSentences(
        passage
      );

    for (
      let sIdx = 0;
      sIdx <
      sentences.length;
      sIdx++
    ) {
      const sentence =
        sentences[sIdx]
          .trim();

      if (
        sentence.length <
        8
      ) {
        continue;
      }

      const normalized =
        normalizeText(
          sentence
        );

      if (
        seen.has(
          normalized
        )
      ) {
        continue;
      }

      seen.add(
        normalized
      );

      candidates.push({
        raw:
          sentence,
        normalized,
        chunkId:
          chunk.chunk_id,
        parentText:
          passage,
        chunkText:
          chunk.text,
        orderIndex:
          sIdx,
        chunkRank:
          cIdx
      });
    }
  }

  if (
    candidates.length ===
    0
  ) {
    return {
      answer: refusal,
      selectedSentences: [],
      sourceChunkId:
        topChunks[0]
          .chunk_id,
      sourcePassage:
        topChunks[0]
          .text,
      confidence: 0.1,
      coverageRatio: 0,
      requirementsCount:
        requirements.length,
      coveredRequirementsCount:
        0,
      extractedFromParent:
        false
    };
  }

  /* ---------------------------------------------------------------------- */
  /* ENTITY-ONLY MODE                                                       */
  /* ---------------------------------------------------------------------- */

  if (
    entityOnly
  ) {
    const req =
      requirements[0];

    let best:
      CandidateSentence | null =
      null;

    let bestScore =
      0;

    for (
      const candidate
      of candidates
    ) {
      const subject =
        subjectAppearsInSentence(
          candidate.raw,
          querySubjects
        );

      /*
       * For entity-only queries:
       *
       * EXACT ENTITY PRESENCE IS MANDATORY.
       */
      if (
        querySubjects.length >
          0 &&
        !subject
      ) {
        continue;
      }

      const score =
        scoreSentenceForRequirement(
          candidate.raw,
          req
        );

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        best =
          candidate;
      }
    }

    /*
     * If no query subject was extracted, use exact token
     * matching against the query itself.
     */
    if (
      !best &&
      querySubjects.length ===
        0
    ) {
      const queryTokens =
        extractContentTokens(
          query
        );

      for (
        const candidate
        of candidates
      ) {
        const text =
          candidate.normalized;

        const allPresent =
          queryTokens.every(
            (token) =>
              text.includes(
                token
              )
          );

        if (
          allPresent
        ) {
          const score =
            queryTokens.length +
            (
              candidate.chunkRank ===
              0
                ? 0.2
                : 0
            );

          if (
            score >
            bestScore
          ) {
            bestScore =
              score;
            best =
              candidate;
          }
        }
      }
    }

    if (
      !best
    ) {
      return {
        answer: refusal,
        selectedSentences: [],
        sourceChunkId:
          topChunks[0]
            .chunk_id,
        sourcePassage:
          topChunks[0]
            .text,
        confidence: 0.08,
        coverageRatio: 0,
        requirementsCount:
          1,
        coveredRequirementsCount:
          0,
        extractedFromParent:
          false
      };
    }

    /*
     * IMPORTANT:
     *
     * Do NOT return the entire parent passage.
     * Return only the strongest sentence.
     */
    return {
      answer:
        best.raw,
      selectedSentences:
        [best.raw],
      sourceChunkId:
        best.chunkId,
      sourcePassage:
        best.chunkText,
      confidence:
        Math.min(
          0.96,
          Math.max(
            0.65,
            bestScore /
              10
          )
        ),
      coverageRatio:
        1,
      requirementsCount:
        1,
      coveredRequirementsCount:
        1,
      extractedFromParent:
        best.parentText !==
        best.chunkText
    };
  }

  /* ---------------------------------------------------------------------- */
  /* NORMAL QUESTION MODE                                                   */
  /* ---------------------------------------------------------------------- */

  const selected =
    new Set<number>();

  const covered =
    new Array<boolean>(
      requirements.length
    ).fill(false);

  let totalScore =
    0;

  for (
    let reqIdx = 0;
    reqIdx <
    requirements.length;
    reqIdx++
  ) {
    const req =
      requirements[
        reqIdx
      ];

    let bestIdx =
      -1;

    let bestScore =
      0;

    for (
      let i = 0;
      i <
      candidates.length;
      i++
    ) {
      const candidate =
        candidates[i];

      let score =
        scoreSentenceForRequirement(
          candidate.raw,
          req
        );

      /*
       * Never let unrelated biological subject through.
       */
      if (
        sentenceContainsWrongKnownSubject(
          candidate.raw,
          querySubjects
        ) &&
        !subjectAppearsInSentence(
          candidate.raw,
          querySubjects
        )
      ) {
        score = 0;
      }

      /*
       * Retrieval rank only gets a tiny bonus.
       */
      if (
        candidate.chunkRank ===
        0
      ) {
        score +=
          0.15;
      }

      if (
        candidate.chunkRank ===
        1
      ) {
        score +=
          0.05;
      }

      /*
       * Relation question:
       * subject + relation are mandatory.
       */
      if (
        req.intent ===
        'RELATION'
      ) {
        const subject =
          subjectAppearsInSentence(
            candidate.raw,
            querySubjects
          );

        const relation =
          hasRelationWord(
            candidate.raw,
            RELATION_WORDS
          );

        if (
          !subject ||
          !relation
        ) {
          score = 0;
        }
      }

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        bestIdx =
          i;
      }
    }

    /*
     * Do not select weak evidence.
     */
    if (
      bestIdx >= 0 &&
      bestScore >= 2
    ) {
      selected.add(
        bestIdx
      );

      covered[
        reqIdx
      ] = true;

      totalScore +=
        bestScore;
    }
  }

  const coveredCount =
    covered.filter(
      Boolean
    ).length;

  const coverageRatio =
    requirements.length
      ? coveredCount /
        requirements.length
      : 0;

  /*
   * Strict refusal.
   */
  if (
    selected.size ===
      0 ||
    coverageRatio <
      0.5
  ) {
    return {
      answer: refusal,
      selectedSentences: [],
      sourceChunkId:
        topChunks[0]
          .chunk_id,
      sourcePassage:
        topChunks[0]
          .text,
      confidence: 0.1,
      coverageRatio,
      requirementsCount:
        requirements.length,
      coveredRequirementsCount:
        coveredCount,
      extractedFromParent:
        false
    };
  }

  /* ---------------------------------------------------------------------- */
  /* FINAL SENTENCES                                                        */
  /* ---------------------------------------------------------------------- */

  const finalCandidates =
    Array.from(
      selected
    )
      .map(
        (idx) =>
          candidates[idx]
      )
      .filter(
        (candidate) => {
          const wrong =
            sentenceContainsWrongKnownSubject(
              candidate.raw,
              querySubjects
            );

          const correct =
            subjectAppearsInSentence(
              candidate.raw,
              querySubjects
            );

          return !(
            wrong &&
            !correct
          );
        }
      )
      .sort(
        (a, b) => {
          if (
            a.chunkRank !==
            b.chunkRank
          ) {
            return (
              a.chunkRank -
              b.chunkRank
            );
          }

          return (
            a.orderIndex -
            b.orderIndex
          );
        }
      )
      .slice(
        0,
        4
      );

  if (
    finalCandidates.length ===
    0
  ) {
    return {
      answer: refusal,
      selectedSentences: [],
      sourceChunkId:
        topChunks[0]
          .chunk_id,
      sourcePassage:
        topChunks[0]
          .text,
      confidence: 0.05,
      coverageRatio: 0,
      requirementsCount:
        requirements.length,
      coveredRequirementsCount:
        0,
      extractedFromParent:
        false
    };
  }

  const answer =
    finalCandidates
      .map(
        (c) =>
          c.raw
      )
      .join(' ')
      .trim();

  const confidence =
    Math.min(
      0.97,
      Math.max(
        0.45,
        (
          totalScore /
          Math.max(
            1,
            requirements.length *
              8
          )
        ) *
          coverageRatio
      )
    );

  return {
    answer,
    selectedSentences:
      finalCandidates.map(
        (c) =>
          c.raw
      ),
    sourceChunkId:
      finalCandidates[0]
        .chunkId,
    sourcePassage:
      finalCandidates[0]
        .parentText,
    confidence:
      Number(
        confidence.toFixed(
          3
        )
      ),
    coverageRatio:
      Number(
        coverageRatio.toFixed(
          3
        )
      ),
    requirementsCount:
      requirements.length,
    coveredRequirementsCount:
      coveredCount,
    extractedFromParent:
      finalCandidates[0]
        .parentText !==
      finalCandidates[0]
        .chunkText
  };
}

/* -------------------------------------------------------------------------- */
/* BACKWARD COMPATIBILITY                                                     */
/* -------------------------------------------------------------------------- */

export function extractAnswerFromPassage(
  query: string,
  topChunk: Chunk
): ExtractedAnswer {
  return extractGroundedAnswer(
    query,
    [topChunk]
  );
}