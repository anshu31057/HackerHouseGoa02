import { performance } from 'perf_hooks';
import { Chunk } from '../chunking/types.js';
import { ChunkStrategy } from '../chunking/index.js';
import { VectorIndex } from '../retrieval/hnsw.js';
import { BM25Index } from '../retrieval/bm25.js';
import { reciprocalRankFusion } from '../retrieval/rrf.js';
import {
  rerankCandidates,
  RerankedCandidate,
} from '../retrieval/reranker.js';

import {
  checkSafetyGuardrail,
  checkOffTopicGuardrail,
  checkCoverageGuardrail,
  checkGroundingGuardrail,
  checkUnderspecifiedQuery,
  getDeterministicQueryExpansion,
  ValidationTelemetry,
  GuardrailStatus,
} from '../guardrails/index.js';

import {
  extractGroundedAnswer,
  ExtractedAnswer,
} from './extractor.js';

import { EmbeddingService } from '../services/embedding.js';

export interface RAGLatencies {
  query_processing: number;
  embedding: number;
  dense_retrieval: number;
  bm25_retrieval: number;
  rrf: number;
  reranking: number;
  query_validation: number;
  answer_extraction: number;
  grounding: number;
  total_rag: number;
}

export interface RAGSource {
  chunk_id: string;
  doc_id: string;
  title?: string;
  strategy: string;
  strategies: string[];
  language: string;
  text: string;
  parent_id?: string;
  parent_text?: string;
  finalScore: number;
  denseRank: number | null;
  bm25Rank: number | null;
}

export interface RAGResponse {
  query: string;
  answer: string;
  grounded: boolean;
  confidence: number;
  guardrail_status: GuardrailStatus;

  refusal_reason?: string;

  coverage_ratio?: number;
  requirements_count?: number;
  covered_requirements_count?: number;

  query_relevance_score?: number;
  entity_match_score?: number;
  coverage_score?: number;
  question_type_score?: number;
  final_confidence?: number;

  rejection_reason?: string | null;

  telemetry?: ValidationTelemetry;

  sources: RAGSource[];

  latencies: RAGLatencies;
}

/**
 * Deduplicate candidates representing the same parent passage.
 */
export function deduplicateCandidates(
  candidates: RerankedCandidate[],
  maxUnique: number = 3
): RerankedCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) => b.finalScore - a.finalScore
  );

  const seenMap = new Map<string, RerankedCandidate>();

  for (const cand of sorted) {
    const chunk = cand.chunk;

    let key = chunk.parent_id
      ? `parent:${chunk.parent_id}`
      : '';

    if (!key) {
      const textHead = chunk.text
        .slice(0, 100)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');

      key = `doc:${chunk.doc_id || 'unknown'}:${textHead}`;
    }

    if (seenMap.has(key)) {
      const existing = seenMap.get(key)!;

      const strats = new Set(
        existing.contributingStrategies || [
          existing.chunk.strategy,
        ]
      );

      if (chunk.strategy) {
        strats.add(chunk.strategy);
      }

      existing.contributingStrategies =
        Array.from(strats);
    } else {
      const copy: RerankedCandidate = {
        ...cand,
        contributingStrategies: [
          chunk.strategy || 'auto',
        ],
      };

      seenMap.set(key, copy);
    }
  }

  return Array.from(seenMap.values()).slice(
    0,
    maxUnique
  );
}

export class RAGPipeline {
  private chunks: Chunk[] = [];

  private vectorIndex: VectorIndex;

  private bm25Index: BM25Index;

  private embeddingService: EmbeddingService;

  private isReady: boolean = false;

  constructor(
    chunks: Chunk[],
    vectorIndex: VectorIndex,
    bm25Index: BM25Index
  ) {
    this.chunks = chunks;

    this.vectorIndex = vectorIndex;

    this.bm25Index = bm25Index;

    this.embeddingService =
      EmbeddingService.getInstance();

    this.isReady =
      chunks.length > 0 &&
      vectorIndex.size > 0 &&
      bm25Index.size > 0;
  }

  public setIndexes(
    chunks: Chunk[],
    vectorIndex: VectorIndex,
    bm25Index: BM25Index
  ): void {
    this.chunks = chunks;

    this.vectorIndex = vectorIndex;

    this.bm25Index = bm25Index;

    this.isReady =
      chunks.length > 0 &&
      vectorIndex.size > 0 &&
      bm25Index.size > 0;
  }

  public get ready(): boolean {
    return this.isReady;
  }

  public get totalChunks(): number {
    return this.chunks.length;
  }

  /**
   * Main low-latency Voice RAG execution pipeline.
   *
   * Optimized retrieval:
   * Dense: 20
   * BM25: 20
   * RRF: 20
   * Reranking: 5
   *
   * Final sources remain limited to 3.
   */
  public async execute(
    queryText: string,
    strategyFilter?: ChunkStrategy,
    bypassCache: boolean = false
  ): Promise<RAGResponse> {
    const totalStart = performance.now();

    // ============================================================
    // STAGE 1: QUERY PROCESSING + EARLY GUARDRAILS
    // ============================================================

    const t0 = performance.now();

    const cleanQuery = queryText.trim();

    const underspecifiedCheck =
      checkUnderspecifiedQuery(cleanQuery);

    if (underspecifiedCheck.isUnderspecified) {
      const qpLat = performance.now() - t0;
      const totalLat =
        performance.now() - totalStart;

      return {
        query: cleanQuery,
        answer:
          "I don't have enough information in your question to identify what you want to know.",
        grounded: false,
        confidence: 0,
        guardrail_status:
          'INSUFFICIENT_CONTEXT',
        refusal_reason:
          'underspecified_query',
        rejection_reason:
          'underspecified_query',

        query_relevance_score: 0,
        entity_match_score: 0,
        coverage_score: 0,
        question_type_score: 0,
        final_confidence: 0,

        telemetry: {
          query_relevance_score: 0,
          entity_match_score: 0,
          coverage_score: 0,
          question_type_score: 0,
          final_confidence: 0,
          rejection_reason:
            'underspecified_query',
        },

        sources: [],

        latencies: {
          query_processing:
            Number(qpLat.toFixed(3)),
          embedding: 0,
          dense_retrieval: 0,
          bm25_retrieval: 0,
          rrf: 0,
          reranking: 0,
          query_validation: 0,
          answer_extraction: 0,
          grounding: 0,
          total_rag:
            Number(totalLat.toFixed(3)),
        },
      };
    }

    // ------------------------------------------------------------
    // Safety guardrail
    // ------------------------------------------------------------

    const safetyResult =
      checkSafetyGuardrail(cleanQuery);

    if (!safetyResult.passed) {
      const qpLat = performance.now() - t0;
      const totalLat =
        performance.now() - totalStart;

      return {
        query: cleanQuery,
        answer:
          'I cannot answer this question as it violates safety guardrails.',
        grounded: false,
        confidence: 0,
        guardrail_status: 'UNSAFE',
        refusal_reason:
          safetyResult.reason,
        rejection_reason:
          'safety_policy_violation',

        query_relevance_score: 0,
        entity_match_score: 0,
        coverage_score: 0,
        question_type_score: 0,
        final_confidence: 0,

        sources: [],

        latencies: {
          query_processing:
            Number(qpLat.toFixed(3)),
          embedding: 0,
          dense_retrieval: 0,
          bm25_retrieval: 0,
          rrf: 0,
          reranking: 0,
          query_validation: 0,
          answer_extraction: 0,
          grounding: 0,
          total_rag:
            Number(totalLat.toFixed(3)),
        },
      };
    }

    // ------------------------------------------------------------
    // Off-topic guardrail
    // ------------------------------------------------------------

    const offTopicResult =
      checkOffTopicGuardrail(cleanQuery);

    if (!offTopicResult.passed) {
      const qpLat = performance.now() - t0;
      const totalLat =
        performance.now() - totalStart;

      return {
        query: cleanQuery,
        answer:
          "I don't have enough supporting information in the indexed knowledge base to answer that.",
        grounded: false,
        confidence: 0,
        guardrail_status: 'OFF_TOPIC',
        refusal_reason:
          offTopicResult.reason,
        rejection_reason:
          'off_topic_query',

        query_relevance_score: 0,
        entity_match_score: 0,
        coverage_score: 0,
        question_type_score: 0,
        final_confidence: 0,

        sources: [],

        latencies: {
          query_processing:
            Number(qpLat.toFixed(3)),
          embedding: 0,
          dense_retrieval: 0,
          bm25_retrieval: 0,
          rrf: 0,
          reranking: 0,
          query_validation: 0,
          answer_extraction: 0,
          grounding: 0,
          total_rag:
            Number(totalLat.toFixed(3)),
        },
      };
    }

    const queryProcessingLat =
      performance.now() - t0;

    // ============================================================
    // STAGE 2: EMBEDDING
    // ============================================================

    const t1 = performance.now();

    const embResult =
      this.embeddingService.embedTextWithDetails(
        cleanQuery,
        bypassCache
      );

    const queryVector = embResult.vector;

    const embeddingLat =
      performance.now() - t1;

    // ============================================================
    // STAGE 3: DENSE RETRIEVAL
    // OPTIMIZED: 35 -> 20
    // ============================================================

    const t2 = performance.now();

    const denseTop20 =
      this.vectorIndex.search(
        queryVector,
        20
      );

    const denseRetrievalLat =
      performance.now() - t2;

    // ============================================================
    // STAGE 4: BM25
    // OPTIMIZED: 35 -> 20
    // ============================================================

    const t3 = performance.now();

    const expansions =
      getDeterministicQueryExpansion(
        cleanQuery
      );

    const bm25SearchQuery =
      expansions.length > 0
        ? `${cleanQuery} ${expansions.join(' ')}`
        : cleanQuery;

    const bm25Top20 =
      this.bm25Index.search(
        bm25SearchQuery,
        20
      );

    const bm25RetrievalLat =
      performance.now() - t3;

    // ============================================================
    // STAGE 5: RRF FUSION
    // OPTIMIZED: 30 -> 20
    // ============================================================

    const t4 = performance.now();

    const rrfCandidates =
      reciprocalRankFusion(
        denseTop20,
        bm25Top20,
        60,
        20
      );

    const rrfLat =
      performance.now() - t4;

    // ============================================================
    // STRATEGY FILTER
    // ============================================================

    let filteredCandidates =
      rrfCandidates;

    if (
      strategyFilter &&
      strategyFilter !== 'all'
    ) {
      const subset =
        rrfCandidates.filter(
          (c) =>
            this.chunks[c.chunkIndex]
              ?.strategy === strategyFilter
        );

      if (subset.length > 0) {
        filteredCandidates = subset;
      }
    }

    // ============================================================
    // STAGE 6: RERANKING
    // OPTIMIZED: 8 -> 5
    // ============================================================

    const t5 = performance.now();

 const rerankCandidatesInput =
  filteredCandidates.slice(0, 8);

const rerankedAll:
  RerankedCandidate[] =
  rerankCandidates(
    cleanQuery,
    rerankCandidatesInput,
    this.chunks,
    5
  );

    const deduplicatedTop3 =
      deduplicateCandidates(
        rerankedAll,
        3
      );

    const rerankLat =
      performance.now() - t5;

    // ============================================================
    // STAGE 6.5: COVERAGE VALIDATION
    // ============================================================

    const tVal = performance.now();

    const coverageResult =
      checkCoverageGuardrail(
        cleanQuery,
        deduplicatedTop3
      );

    const queryValidationLat =
      performance.now() - tVal;

    // ============================================================
    // FORMAT SOURCES
    // ============================================================

    const formattedSources:
      RAGSource[] =
      deduplicatedTop3.map((c) => {
        const strats =
          c.contributingStrategies &&
          c.contributingStrategies.length > 0
            ? c.contributingStrategies
            : [
                c.chunk.strategy ||
                  'auto',
              ];

        return {
          chunk_id: c.chunk.chunk_id,
          doc_id: c.chunk.doc_id,
          title: c.chunk.title,

          strategy:
            strats.join(' + '),

          strategies: strats,

          language:
            c.chunk.language,

          text:
            c.chunk.text,

          parent_id:
            c.chunk.parent_id,

          parent_text:
            c.chunk.parent_text,

          finalScore:
            Number(
              c.finalScore.toFixed(3)
            ),

          denseRank:
            c.denseRank,

          bm25Rank:
            c.bm25Rank,
        };
      });

    // ============================================================
    // EARLY REFUSAL
    // ============================================================

    if (!coverageResult.passed) {
      const totalLat =
        performance.now() -
        totalStart;

      return {
        query: cleanQuery,

        answer:
          "I don't have enough supporting information in the indexed knowledge base to answer that.",

        grounded: false,

        confidence:
          Number(
            (
              coverageResult.confidence ||
              0
            ).toFixed(3)
          ),

        guardrail_status:
          coverageResult.status,

        refusal_reason:
          coverageResult.reason,

        rejection_reason:
          coverageResult.telemetry
            .rejection_reason,

        query_relevance_score:
          coverageResult.telemetry
            .query_relevance_score,

        entity_match_score:
          coverageResult.telemetry
            .entity_match_score,

        coverage_score:
          coverageResult.telemetry
            .coverage_score,

        question_type_score:
          coverageResult.telemetry
            .question_type_score,

        final_confidence:
          coverageResult.telemetry
            .final_confidence,

        telemetry:
          coverageResult.telemetry,

        sources:
          formattedSources,

        latencies: {
          query_processing:
            Number(
              queryProcessingLat.toFixed(3)
            ),

          embedding:
            Number(
              embeddingLat.toFixed(3)
            ),

          dense_retrieval:
            Number(
              denseRetrievalLat.toFixed(3)
            ),

          bm25_retrieval:
            Number(
              bm25RetrievalLat.toFixed(3)
            ),

          rrf:
            Number(
              rrfLat.toFixed(3)
            ),

          reranking:
            Number(
              rerankLat.toFixed(3)
            ),

          query_validation:
            Number(
              queryValidationLat.toFixed(3)
            ),

          answer_extraction: 0,

          grounding: 0,

          total_rag:
            Number(
              totalLat.toFixed(3)
            ),
        },
      };
    }

    // ============================================================
    // STAGE 7: EXTRACTIVE ANSWER
    // ============================================================

    const t6 = performance.now();

    const candidateChunks =
      deduplicatedTop3.map(
        (c) => c.chunk
      );

    const extracted:
      ExtractedAnswer =
      extractGroundedAnswer(
        cleanQuery,
        candidateChunks
      );

    const answerExtractionLat =
      performance.now() - t6;

    // ============================================================
    // STAGE 8: GROUNDING
    // ============================================================

    const t7 = performance.now();

    const groundingResult =
      checkGroundingGuardrail(
        extracted.answer,
        extracted.sourcePassage
      );

    const groundingLat =
      performance.now() - t7;

    const totalRagLat =
      performance.now() -
      totalStart;

    // ============================================================
    // GROUNDING FAILURE
    // ============================================================

    if (
      extracted.coverageRatio < 0.35 ||
      !groundingResult.passed
    ) {
      return {
        query: cleanQuery,

        answer:
          "I don't have enough supporting information in the indexed knowledge base to answer that.",

        grounded: false,

        confidence:
          Number(
            (
              extracted.confidence *
              0.5
            ).toFixed(3)
          ),

        guardrail_status:
          'GROUNDING_FAILED',

        refusal_reason:
          groundingResult.reason ||
          'Insufficient query requirement coverage',

        rejection_reason:
          'grounding_verification_failed',

        query_relevance_score:
          coverageResult.telemetry
            .query_relevance_score,

        entity_match_score:
          coverageResult.telemetry
            .entity_match_score,

        coverage_score:
          coverageResult.telemetry
            .coverage_score,

        question_type_score:
          coverageResult.telemetry
            .question_type_score,

        final_confidence:
          Number(
            (
              extracted.confidence *
              0.5
            ).toFixed(3)
          ),

        telemetry: {
          ...coverageResult.telemetry,

          rejection_reason:
            'grounding_verification_failed',
        },

        coverage_ratio:
          extracted.coverageRatio,

        requirements_count:
          extracted.requirementsCount,

        covered_requirements_count:
          extracted.coveredRequirementsCount,

        sources:
          formattedSources,

        latencies: {
          query_processing:
            Number(
              queryProcessingLat.toFixed(3)
            ),

          embedding:
            Number(
              embeddingLat.toFixed(3)
            ),

          dense_retrieval:
            Number(
              denseRetrievalLat.toFixed(3)
            ),

          bm25_retrieval:
            Number(
              bm25RetrievalLat.toFixed(3)
            ),

          rrf:
            Number(
              rrfLat.toFixed(3)
            ),

          reranking:
            Number(
              rerankLat.toFixed(3)
            ),

          query_validation:
            Number(
              queryValidationLat.toFixed(3)
            ),

          answer_extraction:
            Number(
              answerExtractionLat.toFixed(3)
            ),

          grounding:
            Number(
              groundingLat.toFixed(3)
            ),

          total_rag:
            Number(
              totalRagLat.toFixed(3)
            ),
        },
      };
    }

    // ============================================================
    // FINAL CONFIDENCE
    // ============================================================

    const compositeConfidence =
      extracted.coverageRatio >= 1.0
        ? Math.min(
            0.99,
            Math.max(
              0.70,
              (
                coverageResult
                  .telemetry
                  .final_confidence *
                  0.5 +
                extracted.confidence *
                  0.5
              )
            )
          )
        : Math.min(
            0.60,
            Number(
              (
                extracted.confidence *
                extracted.coverageRatio
              ).toFixed(3)
            )
          );

    // ============================================================
    // FINAL RESPONSE
    // ============================================================

    return {
      query: cleanQuery,

      answer:
        extracted.answer,

      grounded:
        extracted.coverageRatio >= 1.0,

      confidence:
        Number(
          compositeConfidence.toFixed(3)
        ),

      guardrail_status:
        'PASSED',

      query_relevance_score:
        coverageResult.telemetry
          .query_relevance_score,

      entity_match_score:
        coverageResult.telemetry
          .entity_match_score,

      coverage_score:
        coverageResult.telemetry
          .coverage_score,

      question_type_score:
        coverageResult.telemetry
          .question_type_score,

      final_confidence:
        Number(
          compositeConfidence.toFixed(3)
        ),

      rejection_reason:
        null,

      telemetry: {
        ...coverageResult.telemetry,

        final_confidence:
          Number(
            compositeConfidence.toFixed(3)
          ),
      },

      coverage_ratio:
        extracted.coverageRatio,

      requirements_count:
        extracted.requirementsCount,

      covered_requirements_count:
        extracted.coveredRequirementsCount,

      sources:
        formattedSources,

      latencies: {
        query_processing:
          Number(
            queryProcessingLat.toFixed(3)
          ),

        embedding:
          Number(
            embeddingLat.toFixed(3)
          ),

        dense_retrieval:
          Number(
            denseRetrievalLat.toFixed(3)
          ),

        bm25_retrieval:
          Number(
            bm25RetrievalLat.toFixed(3)
          ),

        rrf:
          Number(
            rrfLat.toFixed(3)
          ),

        reranking:
          Number(
            rerankLat.toFixed(3)
          ),

        query_validation:
          Number(
            queryValidationLat.toFixed(3)
          ),

        answer_extraction:
          Number(
            answerExtractionLat.toFixed(3)
          ),

        grounding:
          Number(
            groundingLat.toFixed(3)
          ),

        total_rag:
          Number(
            totalRagLat.toFixed(3)
          ),
      },
    };
  }
}