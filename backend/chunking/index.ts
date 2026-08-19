import { RawDocument, Chunk } from './types.js';
import { chunkFixed } from './fixed.js';
import { chunkSentence } from './sentence.js';
import { chunkSemantic } from './semantic.js';
import { chunkMetadata } from './metadata.js';

export * from './types.js';
export * from './fixed.js';
export * from './sentence.js';
export * from './semantic.js';
export * from './metadata.js';

export type ChunkStrategy = 'fixed' | 'sentence' | 'semantic' | 'metadata' | 'all';

/**
 * Applies specified chunking strategy (or all strategies) to a document.
 */
export function chunkDocument(doc: RawDocument, strategy: ChunkStrategy = 'all'): Chunk[] {
  switch (strategy) {
    case 'fixed':
      return chunkFixed(doc);
    case 'sentence':
      return chunkSentence(doc);
    case 'semantic':
      return chunkSemantic(doc);
    case 'metadata':
      return chunkMetadata(doc);
    case 'all': {
      const fixed = chunkFixed(doc);
      const sentence = chunkSentence(doc);
      const semantic = chunkSemantic(doc);
      const metadata = chunkMetadata(doc);
      return [...fixed, ...sentence, ...semantic, ...metadata];
    }
  }
}
