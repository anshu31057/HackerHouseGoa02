import fs from 'fs';
import path from 'path';
import { RawDocument, Chunk } from '../chunking/types.js';
import { chunkDocument } from '../chunking/index.js';
import { VectorIndex } from '../retrieval/hnsw.js';
import { BM25Index } from '../retrieval/bm25.js';
import { EmbeddingService } from '../services/embedding.js';
import { generateProductionDocuments } from './dataset.js';

export interface BuildIndexResult {
  totalDocuments: number;
  totalChunks: number;
  chunksByStrategy: Record<string, number>;
  vectorIndexSize: number;
  bm25IndexSize: number;
  artifactsDir: string;
}

export function buildAndSaveIndexes(
  targetDocCount: number = 2600,
  outputDir: string = path.resolve(process.cwd(), 'data/processed')
): BuildIndexResult {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[Ingestion] Generating production documents (target: ${targetDocCount})...`);
  const documents: RawDocument[] = generateProductionDocuments(targetDocCount);
  console.log(`[Ingestion] Generated ${documents.length} raw documents.`);

  console.log(`[Chunking] Applying 4 distinct chunking strategies (fixed, sentence, semantic, metadata)...`);
  const allChunks: Chunk[] = [];
  const chunksByStrategy: Record<string, number> = {
    fixed: 0,
    sentence: 0,
    semantic: 0,
    metadata: 0,
  };

  for (const doc of documents) {
    const docChunks = chunkDocument(doc, 'all');
    for (const ch of docChunks) {
      allChunks.push(ch);
      chunksByStrategy[ch.strategy] = (chunksByStrategy[ch.strategy] || 0) + 1;
    }
  }

  console.log(`[Chunking] Total chunks produced: ${allChunks.length} chunks.`);
  console.log(`[Chunking] Breakdown:`, chunksByStrategy);

  // 1. Save chunks metadata & text lookup
  console.log(`[Storage] Saving chunk metadata to ${outputDir}/chunks.json...`);
  fs.writeFileSync(path.join(outputDir, 'chunks.json'), JSON.stringify(allChunks));

  // 2. Build and save BM25 Index
  console.log(`[Indexing] Building sparse BM25 inverted index...`);
  const bm25 = new BM25Index(1.2, 0.75);
  const corpusTexts = allChunks.map((c) => c.text);
  bm25.buildFromCorpus(corpusTexts);
  const serializedBM25 = bm25.serialize();
  fs.writeFileSync(path.join(outputDir, 'bm25_index.json'), JSON.stringify(serializedBM25));
  console.log(`[Indexing] BM25 Index saved with ${bm25.size} indexed documents.`);

  // 3. Precompute Normalized Vector Embeddings & Build Vector Index
  console.log(`[Indexing] Precomputing normalized vector embeddings with in-process multilingual engine...`);
  const embeddingService = EmbeddingService.getInstance();
  const vectorList: Float32Array[] = new Array(allChunks.length);

  for (let i = 0; i < allChunks.length; i++) {
    vectorList[i] = embeddingService.embedText(allChunks[i].text);
  }

  const vectorIndex = new VectorIndex();
  vectorIndex.buildFromVectors(vectorList);
  const serializedVectors = vectorIndex.serialize();
  fs.writeFileSync(path.join(outputDir, 'vector_index.json'), JSON.stringify(serializedVectors));
  console.log(`[Indexing] Vector Index saved with ${vectorIndex.size} indexed vectors.`);

  return {
    totalDocuments: documents.length,
    totalChunks: allChunks.length,
    chunksByStrategy,
    vectorIndexSize: vectorIndex.size,
    bm25IndexSize: bm25.size,
    artifactsDir: outputDir,
  };
}
