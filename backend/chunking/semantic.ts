import { RawDocument, Chunk } from './types.js';
import { splitSentences } from './sentence.js';

export interface SemanticChunkOptions {
  maxWordsPerChunk?: number;
  similarityThreshold?: number;
}

/**
 * Discourse boundary markers that indicate semantic topic shifts or conclusions.
 */
const TRANSITION_MARKERS = [
  'furthermore', 'moreover', 'however', 'in addition', 'on the other hand',
  'consequently', 'therefore', 'as a result', 'in conclusion', 'firstly',
  'secondly', 'specifically', 'for example', 'for instance', 'meanwhile',
  'इसके अलावा', 'हालांकि', 'परिणामस्वरूप', 'उदाहरण के लिए', 'विशेष रूप से',
  'तथापि', 'অন্যদিকে', 'উদাহরণস্বরূপ', 'மேலும்', 'எனவே'
];

/**
 * Calculates lexical Jaccard similarity between two sentence token sets.
 */
function sentenceJaccard(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getTokens(str: string): Set<string> {
  return new Set(
    str.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Semantic chunking splits along semantic coherence boundaries:
 * paragraph breaks, transition markers, and topic shift drop-offs in lexical overlap.
 */
export function chunkSemantic(doc: RawDocument, options: SemanticChunkOptions = {}): Chunk[] {
  const maxWords = options.maxWordsPerChunk ?? 80;

  // Split by double newlines first (paragraphs)
  const paragraphs = doc.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units: string[] = [];

  for (const para of paragraphs) {
    const sentences = splitSentences(para);
    if (sentences.length <= 1) {
      if (para.length > 0) units.push(para);
      continue;
    }

    let currentSegment: string[] = [sentences[0]];
    let currentTokens = getTokens(sentences[0]);

    for (let i = 1; i < sentences.length; i++) {
      const nextSent = sentences[i];
      const nextLower = nextSent.toLowerCase();
      const hasTransition = TRANSITION_MARKERS.some((marker) => nextLower.startsWith(marker));
      const nextTokens = getTokens(nextSent);
      const similarity = sentenceJaccard(currentTokens, nextTokens);

      // Break if explicit transition marker or clear semantic topic drop
      const wordCountSoFar = currentSegment.join(' ').split(/\s+/).length;
      if ((hasTransition || similarity < 0.05) && wordCountSoFar >= 30) {
        units.push(currentSegment.join(' '));
        currentSegment = [nextSent];
        currentTokens = nextTokens;
      } else {
        currentSegment.push(nextSent);
        // Union tokens
        for (const t of nextTokens) currentTokens.add(t);
      }
    }
    if (currentSegment.length > 0) {
      units.push(currentSegment.join(' '));
    }
  }

  // Merge small adjacent units if below threshold, or split oversized units
  const chunks: Chunk[] = [];
  let chunkIdx = 0;
  let buffer: string[] = [];
  let bufferWords = 0;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const words = unit.split(/\s+/).filter(Boolean).length;

    if (bufferWords + words > maxWords && buffer.length > 0) {
      const text = buffer.join(' ');
      chunks.push({
        chunk_id: `${doc.id}_sem_${chunkIdx}`,
        doc_id: doc.id,
        query: doc.query,
        language: doc.language || 'en',
        title: doc.title,
        source: doc.source || 'msmarco-xi',
        strategy: 'semantic',
        parent_id: doc.id,
        parent_text: doc.text,
        text,
        chunk_index: chunkIdx,
        word_count: bufferWords,
        char_count: text.length,
      });
      chunkIdx++;
      buffer = [];
      bufferWords = 0;
    }

    buffer.push(unit);
    bufferWords += words;
  }

  if (buffer.length > 0) {
    const text = buffer.join(' ');
    chunks.push({
      chunk_id: `${doc.id}_sem_${chunkIdx}`,
      doc_id: doc.id,
      query: doc.query,
      language: doc.language || 'en',
      title: doc.title,
      source: doc.source || 'msmarco-xi',
      strategy: 'semantic',
      parent_id: doc.id,
      parent_text: doc.text,
      text,
      chunk_index: chunkIdx,
      word_count: bufferWords,
      char_count: text.length,
    });
  }

  return chunks;
}
