export interface RawDocument {
  id: string;
  title: string;
  text: string;
  language: string;
  source: string;
  query?: string;
  metadata?: Record<string, any>;
}

export interface Chunk {
  chunk_id: string;
  doc_id: string;
  query?: string;
  language: string;
  title?: string;
  source: string;
  strategy: 'fixed' | 'sentence' | 'semantic' | 'metadata';
  parent_id?: string;
  parent_text?: string;
  text: string;
  chunk_index: number;
  word_count: number;
  char_count: number;
}
