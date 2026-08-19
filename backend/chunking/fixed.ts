import { RawDocument, Chunk } from './types.js';

export interface FixedChunkOptions {
  chunkSizeWords?: number;
  chunkOverlapWords?: number;
}

/**
 * Fixed-size word chunking with sliding window and overlap.
 * Preserves clean word boundaries.
 */
export function chunkFixed(doc: RawDocument, options: FixedChunkOptions = {}): Chunk[] {
  const chunkSize = options.chunkSizeWords ?? 60;
  const chunkOverlap = options.chunkOverlapWords ?? 15;
  const step = Math.max(1, chunkSize - chunkOverlap);

  const words = doc.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: Chunk[] = [];
  let chunkIdx = 0;

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length === 0) break;

    const text = chunkWords.join(' ');
    chunks.push({
      chunk_id: `${doc.id}_fixed_${chunkIdx}`,
      doc_id: doc.id,
      query: doc.query,
      language: doc.language || 'en',
      title: doc.title,
      source: doc.source || 'msmarco-xi',
      strategy: 'fixed',
      parent_id: doc.id,
      parent_text: doc.text,
      text,
      chunk_index: chunkIdx,
      word_count: chunkWords.length,
      char_count: text.length,
    });

    chunkIdx++;
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}
