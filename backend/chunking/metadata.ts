import { RawDocument, Chunk } from './types.js';

export interface MetadataChunkOptions {
  includeTitlePrefix?: boolean;
  includeQueryContext?: boolean;
}

/**
 * Metadata-aware chunking.
 * Incorporates structural header metadata, language tags, doc provenance,
 * and contextual parent-child linkages to maximize retrieval accuracy.
 */
export function chunkMetadata(doc: RawDocument, options: MetadataChunkOptions = {}): Chunk[] {
  const includeTitle = options.includeTitlePrefix ?? true;

  // Detect logical sections (markdown headers, bullet points, numbering)
  const lines = doc.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections: { title?: string; body: string[] }[] = [];

  let currentSectionTitle = doc.title || '';
  let currentSectionLines: string[] = [];

  for (const line of lines) {
    const isHeader = /^#{1,4}\s+/.test(line) || /^[A-Z0-9\s]{4,40}:$/.test(line);
    if (isHeader) {
      if (currentSectionLines.length > 0) {
        sections.push({ title: currentSectionTitle, body: currentSectionLines });
        currentSectionLines = [];
      }
      currentSectionTitle = line.replace(/^#{1,4}\s+/, '').replace(/:$/, '');
    } else {
      currentSectionLines.push(line);
    }
  }

  if (currentSectionLines.length > 0) {
    sections.push({ title: currentSectionTitle, body: currentSectionLines });
  }

  if (sections.length === 0) {
    sections.push({ title: doc.title, body: [doc.text] });
  }

  const chunks: Chunk[] = [];
  let chunkIdx = 0;

  for (const section of sections) {
    const rawText = section.body.join(' ');
    const words = rawText.split(/\s+/).filter(Boolean);

    // If section is long, subdivide
    const subChunkSize = 75;
    for (let i = 0; i < words.length; i += subChunkSize) {
      const subWords = words.slice(i, i + subChunkSize);
      if (subWords.length === 0) break;

      const bodyText = subWords.join(' ');
      const titleContext = includeTitle && section.title ? `[${section.title}] ` : '';
      const fullChunkText = `${titleContext}${bodyText}`;

      chunks.push({
        chunk_id: `${doc.id}_meta_${chunkIdx}`,
        doc_id: doc.id,
        query: doc.query,
        language: doc.language || 'en',
        title: section.title || doc.title,
        source: doc.source || 'msmarco-xi',
        strategy: 'metadata',
        parent_id: doc.id,
        parent_text: doc.text,
        text: fullChunkText,
        chunk_index: chunkIdx,
        word_count: subWords.length,
        char_count: fullChunkText.length,
      });

      chunkIdx++;
    }
  }

  return chunks;
}
