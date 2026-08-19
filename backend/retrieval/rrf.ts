import { VectorSearchResult } from './hnsw.js';
import { BM25SearchResult } from './bm25.js';

export interface RRFCandidate {
  chunkIndex: number;
  rrfScore: number;
  denseRank: number | null;
  bm25Rank: number | null;
  denseScore: number;
  bm25Score: number;
}

/**
 * Genuine Reciprocal Rank Fusion (RRF).
 * Combines dense vector retrieval rank and sparse BM25 retrieval rank:
 * score(d) = sum_{m \in methods} ( 1 / (k + rank_m(d)) )
 * Fixed constant k = 60 as per standard IR literature.
 */
export function reciprocalRankFusion(
  denseResults: VectorSearchResult[],
  bm25Results: BM25SearchResult[],
  k: number = 60,
  topK: number = 8
): RRFCandidate[] {
  const candidateMap = new Map<number, RRFCandidate>();

  // Process dense results
  for (let i = 0; i < denseResults.length; i++) {
    const item = denseResults[i];
    const rank = i + 1; // 1-indexed rank
    const contribution = 1.0 / (k + rank);

    candidateMap.set(item.chunkIndex, {
      chunkIndex: item.chunkIndex,
      rrfScore: contribution,
      denseRank: rank,
      bm25Rank: null,
      denseScore: item.score,
      bm25Score: 0,
    });
  }

  // Process BM25 results
  for (let i = 0; i < bm25Results.length; i++) {
    const item = bm25Results[i];
    const rank = i + 1;
    const contribution = 1.0 / (k + rank);

    const existing = candidateMap.get(item.chunkIndex);
    if (existing) {
      existing.rrfScore += contribution;
      existing.bm25Rank = rank;
      existing.bm25Score = item.score;
    } else {
      candidateMap.set(item.chunkIndex, {
        chunkIndex: item.chunkIndex,
        rrfScore: contribution,
        denseRank: null,
        bm25Rank: rank,
        denseScore: 0,
        bm25Score: item.score,
      });
    }
  }

  // Sort descending by RRF score
  const sorted = Array.from(candidateMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
  return sorted.slice(0, topK);
}
