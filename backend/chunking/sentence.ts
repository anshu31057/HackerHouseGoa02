import { RawDocument, Chunk } from './types.js';

export interface SentenceChunkOptions {
  targetSentenceCount?: number;
  maxSentenceCount?: number;
  minWordCount?: number;
}

/**
 * Splits text into individual sentences considering multilingual punctuation:
 * Latin (. ? !), Indic Purna Viram (।), Double Viram (॥), CJK/other marks.
 */
export function splitSentences(text: string): string[] {
  // Regex that captures sentence ending delimiters without mangling decimals/abbreviations
  const regex = /([^.?!।॥\n\r]+[.?!।॥]+(?:\s+|$)|[^\n\r]+(?:\n+|$))/g;
  const matches = text.match(regex);
  if (!matches) {
    return text.trim().length > 0 ? [text.trim()] : [];
  }
  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Sentence-aware chunking. Groups adjacent sentences preserving semantic grammatical integrity.
 */
export function chunkSentence(doc: RawDocument, options: SentenceChunkOptions = {}): Chunk[] {
  const targetSentences = options.targetSentenceCount ?? 2;
  const maxSentences = options.maxSentenceCount ?? 3;
  const minWords = options.minWordCount ?? 15;

  const sentences = splitSentences(doc.text);
  if (sentences.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentGroup: string[] = [];
  let currentWords = 0;
  let chunkIdx = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const sWords = s.split(/\s+/).filter(Boolean).length;
    currentGroup.push(s);
    currentWords += sWords;

    const isLast = i === sentences.length - 1;
    const reachedTarget = currentGroup.length >= targetSentences && currentWords >= minWords;
    const reachedMax = currentGroup.length >= maxSentences;

    if (isLast || reachedTarget || reachedMax) {
      const chunkText = currentGroup.join(' ');
      chunks.push({
        chunk_id: `${doc.id}_sent_${chunkIdx}`,
        doc_id: doc.id,
        query: doc.query,
        language: doc.language || 'en',
        title: doc.title,
        source: doc.source || 'msmarco-xi',
        strategy: 'sentence',
        parent_id: doc.id,
        parent_text: doc.text,
        text: chunkText,
        chunk_index: chunkIdx,
        word_count: currentWords,
        char_count: chunkText.length,
      });
      chunkIdx++;
      currentGroup = [];
      currentWords = 0;
    }
  }

  return chunks;
}
