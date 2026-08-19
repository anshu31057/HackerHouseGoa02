export interface BM25SearchResult {
  chunkIndex: number;
  score: number;
}

export interface SerializedBM25Index {
  numDocs: number;
  avgDocLength: number;
  docLengths: number[];
  idf: Record<string, number>;
  postings: Record<string, [number, number][]>;
}

/* -------------------------------------------------------------------------- */
/* STOP WORDS                                                                */
/* -------------------------------------------------------------------------- */

const STOP_WORDS = new Set([
  // English grammar
  'a', 'an', 'the',
  'and', 'or', 'but',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'over', 'under',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'am',
  'it', 'its',
  'this', 'that', 'these', 'those',
  'there', 'here',
  'as', 'if', 'because', 'while', 'until',
  'than', 'then', 'once',
  'no', 'nor',
  'only', 'own', 'same',
  'some', 'any', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'such', 'very', 'too',
  'can', 'could', 'would', 'should',
  'will', 'shall',
  'may', 'might',
  'must',
  'just', 'now',

  // Question scaffolding
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'when',
  'where',
  'why',
  'how',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',

  // Conversational filler
  'please',
  'tell',
  'explain',
  'give',
  'show',
  'find',
  'know',
  'describe',
  'detail',
  'details',
  'information',
  'mean',
  'means',
  'meaning',

  // Relation verbs
  'carry',
  'carries',
  'carried',
  'transport',
  'transports',
  'transported',
  'contain',
  'contains',
  'produce',
  'produces',
  'provide',
  'provides',
  'include',
  'includes',
  'use',
  'uses',

  // Hindi grammar
  'का',
  'के',
  'की',
  'और',
  'में',
  'है',
  'हैं',
  'था',
  'थी',
  'थे',
  'से',
  'पर',
  'को',
  'यह',
  'वह',
  'ये',
  'वे',
  'एक',
  'इस',
  'उस',
  'इन',
  'उन',
  'या',
  'तो',
  'भी',
  'ही',
  'क्या',
  'कौन',
  'कब',
  'कहाँ',
  'क्यों',
  'कैसे',
  'करता',
  'करती',
  'करते',

  /*
   * IMPORTANT:
   *
   * "नहीं" is deliberately NOT here.
   *
   * Negation is meaningful information:
   *
   * "मेरे पास लाइसेंस है"
   * !=
   * "मेरे पास लाइसेंस नहीं है"
   */
]);

/* -------------------------------------------------------------------------- */
/* TOKENIZATION                                                              */
/* -------------------------------------------------------------------------- */

export function tokenizeBM25(
  text: string
): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(
      /[^\p{L}\p{M}\p{N}\s]/gu,
      ' '
    )
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 2 &&
        !STOP_WORDS.has(w)
    );
}

/**
 * Tokenize without removing stop words.
 *
 * Used only for phrase matching.
 */
function tokenizePhrase(
  text: string
): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(
      /[^\p{L}\p{M}\p{N}\s]/gu,
      ' '
    )
    .split(/\s+/)
    .filter(Boolean);
}

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

/* -------------------------------------------------------------------------- */
/* BM25 INDEX                                                                */
/* -------------------------------------------------------------------------- */

export class BM25Index {
  private k1: number = 1.2;
  private b: number = 0.75;

  private numDocs: number = 0;

  private avgDocLength: number = 0;

  private docLengths: Uint16Array =
    new Uint16Array(0);

  private idf: Map<
    string,
    number
  > = new Map();

  private postings: Map<
    string,
    [number, number][]
  > = new Map();

  constructor(
    k1: number = 1.2,
    b: number = 0.75
  ) {
    this.k1 = k1;
    this.b = b;
  }

  /* ------------------------------------------------------------------------ */
  /* BUILD                                                                    */
  /* ------------------------------------------------------------------------ */

  public buildFromCorpus(
    texts: string[]
  ): void {
    this.numDocs =
      texts.length;

    this.docLengths =
      new Uint16Array(
        this.numDocs
      );

    this.postings.clear();
    this.idf.clear();

    let totalLength = 0;

    for (
      let docIdx = 0;
      docIdx < this.numDocs;
      docIdx++
    ) {
      const tokens =
        tokenizeBM25(
          texts[docIdx]
        );

      this.docLengths[
        docIdx
      ] = Math.min(
        65535,
        tokens.length
      );

      totalLength +=
        tokens.length;

      const tfMap =
        new Map<
          string,
          number
        >();

      for (
        const token of tokens
      ) {
        tfMap.set(
          token,
          (tfMap.get(token) || 0) + 1
        );
      }

      for (
        const [term, freq]
        of tfMap.entries()
      ) {
        let postList =
          this.postings.get(
            term
          );

        if (!postList) {
          postList = [];

          this.postings.set(
            term,
            postList
          );
        }

        postList.push([
          docIdx,
          freq
        ]);
      }
    }

    this.avgDocLength =
      this.numDocs > 0
        ? totalLength /
          this.numDocs
        : 1.0;

    /* ---------------------------------------------------------------------- */
    /* IDF                                                                     */
    /* ---------------------------------------------------------------------- */

    for (
      const [
        term,
        postList
      ] of this.postings.entries()
    ) {
      const n =
        postList.length;

      const idfVal =
        Math.log(
          1.0 +
            (this.numDocs -
              n +
              0.5) /
              (n + 0.5)
        );

      this.idf.set(
        term,
        Math.max(
          0.1,
          idfVal
        )
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* SEARCH                                                                   */
  /* ------------------------------------------------------------------------ */

  public search(
    query: string,
    topK: number = 20
  ): BM25SearchResult[] {
    if (
      this.numDocs === 0
    ) {
      return [];
    }

    const queryTokens =
      tokenizeBM25(query);

    if (
      queryTokens.length === 0
    ) {
      return [];
    }

    const scores =
      new Map<
        number,
        number
      >();

    const k1 =
      this.k1;

    const b =
      this.b;

    const avgLen =
      Math.max(
        1,
        this.avgDocLength
      );

    /* ---------------------------------------------------------------------- */
    /* QUERY TERM FREQUENCY                                                   */
    /* ---------------------------------------------------------------------- */

    const queryTf =
      new Map<
        string,
        number
      >();

    for (
      const token of queryTokens
    ) {
      queryTf.set(
        token,
        (queryTf.get(
          token
        ) || 0) + 1
      );
    }

    /* ---------------------------------------------------------------------- */
    /* STANDARD BM25                                                          */
    /* ---------------------------------------------------------------------- */

    for (
      const [
        token,
        qtf
      ] of queryTf.entries()
    ) {
      const termIdf =
        this.idf.get(
          token
        );

      const postList =
        this.postings.get(
          token
        );

      if (
        !termIdf ||
        !postList
      ) {
        continue;
      }

      /*
       * Repeated query terms receive only a small boost.
       * This avoids letting repeated words dominate retrieval.
       */
      const queryWeight =
        1 +
        Math.min(
          0.25,
          (qtf - 1) * 0.10
        );

      for (
        let i = 0;
        i < postList.length;
        i++
      ) {
        const [
          docIdx,
          tf
        ] =
          postList[i];

        const docLen =
          this.docLengths[
            docIdx
          ];

        const num =
          tf *
          (k1 + 1);

        const denom =
          tf +
          k1 *
            (1 -
              b +
              b *
                (docLen /
                  avgLen));

        const termScore =
          termIdf *
          (num / denom) *
          queryWeight;

        scores.set(
          docIdx,
          (scores.get(
            docIdx
          ) || 0) +
            termScore
        );
      }
    }

    if (
      scores.size === 0
    ) {
      return [];
    }

    /* ---------------------------------------------------------------------- */
    /* RESULT ARRAY                                                           */
    /* ---------------------------------------------------------------------- */

    const results:
      BM25SearchResult[] =
      [];

    for (
      const [
        chunkIndex,
        score
      ] of scores.entries()
    ) {
      results.push({
        chunkIndex,
        score
      });
    }

    /*
     * Stable deterministic ordering.
     *
     * Score first, chunk index second.
     */
    results.sort(
      (a, b) => {
        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        return (
          a.chunkIndex -
          b.chunkIndex
        );
      }
    );

    return results.slice(
      0,
      Math.max(
        1,
        topK
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* SIZE                                                                     */
  /* ------------------------------------------------------------------------ */

  public get size(): number {
    return this.numDocs;
  }

  /* ------------------------------------------------------------------------ */
  /* SERIALIZATION                                                            */
  /* ------------------------------------------------------------------------ */

  public serialize():
    SerializedBM25Index {
    const postingsObj:
      Record<
        string,
        [number, number][]
      > = {};

    for (
      const [
        term,
        postings
      ] of this.postings.entries()
    ) {
      postingsObj[
        term
      ] = postings;
    }

    const idfObj:
      Record<
        string,
        number
      > = {};

    for (
      const [
        term,
        value
      ] of this.idf.entries()
    ) {
      idfObj[
        term
      ] = value;
    }

    return {
      numDocs:
        this.numDocs,

      avgDocLength:
        this.avgDocLength,

      docLengths:
        Array.from(
          this.docLengths
        ),

      idf:
        idfObj,

      postings:
        postingsObj
    };
  }

  /* ------------------------------------------------------------------------ */
  /* DESERIALIZATION                                                          */
  /* ------------------------------------------------------------------------ */

  public static deserialize(
    data: SerializedBM25Index
  ): BM25Index {
    const idx =
      new BM25Index();

    idx.numDocs =
      data.numDocs;

    idx.avgDocLength =
      data.avgDocLength;

    idx.docLengths =
      new Uint16Array(
        data.docLengths
      );

    idx.idf =
      new Map(
        Object.entries(
          data.idf
        )
      );

    idx.postings =
      new Map(
        Object.entries(
          data.postings
        )
      );

    return idx;
  }
}