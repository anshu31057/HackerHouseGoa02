import { EMBEDDING_DIM } from '../services/embedding.js';

export interface VectorSearchResult {
  chunkIndex: number;
  score: number;
}

export interface SerializedVectorIndex {
  numVectors: number;
  dim: number;
  vectorsBase64?: string;
  vectorsArray?: number[][];
}

/**
 * High-performance in-process vector index.
 *
 * Uses:
 * - contiguous Float32Array storage
 * - cosine/dot-product similarity
 * - bounded min-heap for top-K
 * - zero per-vector object allocation during scanning
 *
 * IMPORTANT:
 * This keeps the existing public API and serialized format unchanged.
 */
export class VectorIndex {
  private numVectors = 0;
  private dim: number = EMBEDDING_DIM;
  private vectors: Float32Array = new Float32Array(0);

  constructor(dim: number = EMBEDDING_DIM) {
    this.dim = dim;
  }

  public initFromBuffer(
    numVectors: number,
    buffer: Float32Array
  ): void {
    this.numVectors = numVectors;
    this.vectors = buffer;
  }

  public buildFromVectors(
    vecList: Float32Array[]
  ): void {
    this.numVectors = vecList.length;

    this.vectors = new Float32Array(
      this.numVectors * this.dim
    );

    for (let i = 0; i < this.numVectors; i++) {
      this.vectors.set(
        vecList[i],
        i * this.dim
      );
    }
  }

  public get size(): number {
    return this.numVectors;
  }

  /**
   * Returns top-K vectors by dot-product similarity.
   *
   * NOTE:
   * The underlying index is still a flat vector index.
   * This optimization removes the expensive repeated top-K
   * minimum scan from the old implementation.
   */
  public search(
    queryVec: Float32Array,
    topK: number = 20
  ): VectorSearchResult[] {
    const n = this.numVectors;

    if (
      n === 0 ||
      queryVec.length === 0 ||
      this.vectors.length === 0
    ) {
      return [];
    }

    const k = Math.min(
      Math.max(1, topK | 0),
      n
    );

    const d = Math.min(
      this.dim,
      queryVec.length
    );

    /*
     * Min-heap:
     *
     * heapScores[0] = smallest score currently
     * heapIndices[0] = corresponding vector index
     *
     * This means we only replace the weakest result.
     */
    const heapScores = new Float32Array(k);
    const heapIndices = new Int32Array(k);

    let heapSize = 0;

    const vecs = this.vectors;

    for (let i = 0; i < n; i++) {
      const offset = i * this.dim;

      let dot = 0;

      /*
       * Unrolled dot product.
       *
       * The normal corpus uses 128-dimensional embeddings.
       * The tail loop makes this safe for any dimension.
       */
      let j = 0;

      for (; j + 7 < d; j += 8) {
        dot +=
          queryVec[j] *
            vecs[offset + j] +
          queryVec[j + 1] *
            vecs[offset + j + 1] +
          queryVec[j + 2] *
            vecs[offset + j + 2] +
          queryVec[j + 3] *
            vecs[offset + j + 3] +
          queryVec[j + 4] *
            vecs[offset + j + 4] +
          queryVec[j + 5] *
            vecs[offset + j + 5] +
          queryVec[j + 6] *
            vecs[offset + j + 6] +
          queryVec[j + 7] *
            vecs[offset + j + 7];
      }

      for (; j < d; j++) {
        dot +=
          queryVec[j] *
          vecs[offset + j];
      }

      /*
       * Fill heap until top-K is available.
       */
      if (heapSize < k) {
        heapScores[heapSize] = dot;
        heapIndices[heapSize] = i;

        this.siftUp(
          heapScores,
          heapIndices,
          heapSize
        );

        heapSize++;
        continue;
      }

      /*
       * If this vector isn't better than the
       * weakest top-K result, ignore it immediately.
       */
      if (dot <= heapScores[0]) {
        continue;
      }

      /*
       * Replace weakest result.
       */
      heapScores[0] = dot;
      heapIndices[0] = i;

      this.siftDown(
        heapScores,
        heapIndices,
        heapSize,
        0
      );
    }

    /*
     * Convert heap to result array.
     */
    const results: VectorSearchResult[] =
      new Array(heapSize);

    for (let i = 0; i < heapSize; i++) {
      results[i] = {
        chunkIndex: heapIndices[i],
        score: heapScores[i],
      };
    }

    /*
     * Final descending sort.
     * Only K elements are sorted, never the full corpus.
     */
    results.sort(
      (a, b) => b.score - a.score
    );

    return results;
  }

  /**
   * Move a newly inserted heap item upward.
   */
  private siftUp(
    scores: Float32Array,
    indices: Int32Array,
    index: number
  ): void {
    let child = index;

    while (child > 0) {
      const parent = (child - 1) >> 1;

      if (
        scores[parent] <=
        scores[child]
      ) {
        break;
      }

      const score =
        scores[parent];

      scores[parent] =
        scores[child];

      scores[child] =
        score;

      const vectorIndex =
        indices[parent];

      indices[parent] =
        indices[child];

      indices[child] =
        vectorIndex;

      child = parent;
    }
  }

  /**
   * Restore min-heap after replacing root.
   */
  private siftDown(
    scores: Float32Array,
    indices: Int32Array,
    size: number,
    start: number
  ): void {
    let parent = start;

    while (true) {
      const left =
        parent * 2 + 1;

      if (left >= size) {
        break;
      }

      const right =
        left + 1;

      let smallest = left;

      if (
        right < size &&
        scores[right] <
          scores[left]
      ) {
        smallest = right;
      }

      if (
        scores[parent] <=
        scores[smallest]
      ) {
        break;
      }

      const score =
        scores[parent];

      scores[parent] =
        scores[smallest];

      scores[smallest] =
        score;

      const vectorIndex =
        indices[parent];

      indices[parent] =
        indices[smallest];

      indices[smallest] =
        vectorIndex;

      parent = smallest;
    }
  }

  public serialize(): SerializedVectorIndex {
    const buffer = Buffer.from(
      this.vectors.buffer,
      this.vectors.byteOffset,
      this.vectors.byteLength
    );

    return {
      numVectors: this.numVectors,
      dim: this.dim,
      vectorsBase64:
        buffer.toString('base64'),
    };
  }

  public static deserialize(
    data: SerializedVectorIndex
  ): VectorIndex {
    const idx =
      new VectorIndex(data.dim);

    if (data.vectorsBase64) {
      const buf = Buffer.from(
        data.vectorsBase64,
        'base64'
      );

      const floatArr =
        new Float32Array(
          buf.buffer,
          buf.byteOffset,
          buf.byteLength /
            Float32Array.BYTES_PER_ELEMENT
        );

      idx.initFromBuffer(
        data.numVectors,
        floatArr
      );

    } else if (data.vectorsArray) {
      const flat =
        new Float32Array(
          data.numVectors *
            data.dim
        );

      for (
        let i = 0;
        i < data.numVectors;
        i++
      ) {
        flat.set(
          data.vectorsArray[i],
          i * data.dim
        );
      }

      idx.initFromBuffer(
        data.numVectors,
        flat
      );
    }

    return idx;
  }
}