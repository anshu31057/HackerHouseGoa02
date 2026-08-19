import fs from 'fs';
import path from 'path';
import { RawDocument } from '../chunking/types.js';

/**
 * Real dataset ingestion layer for MSMARCO-XI.
 *
 * IMPORTANT:
 * This file does NOT generate synthetic documents.
 * It reads documents from a local dataset file prepared from the
 * official AI4Bharat/MSMARCO-XI dataset.
 *
 * Supported input:
 *   JSON array:
 *   [
 *     {
 *       "id": "...",
 *       "title": "...",
 *       "text": "...",
 *       "language": "...",
 *       "query": "..."
 *     }
 *   ]
 *
 * JSONL:
 *   {"id":"...","title":"...","text":"...","language":"...","query":"..."}
 *   {"id":"...","title":"...","text":"...","language":"...","query":"..."}
 *
 * The loader normalizes the source records into the project's
 * existing RawDocument format.
 */

export interface DatasetRecord {
  id?: string | number;
  doc_id?: string | number;
  document_id?: string | number;

  title?: string;
  text?: string;
  passage?: string;
  content?: string;

  language?: string;
  lang?: string;

  query?: string;
  question?: string;

  metadata?: Record<string, unknown>;

  [key: string]: unknown;
}

const DEFAULT_DATASET_PATH = path.resolve(
  process.cwd(),
  'data',
  'msmarco_xi.jsonl'
);

function cleanText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function normalizeLanguage(record: DatasetRecord): string {
  return firstNonEmpty(
    record.language,
    record.lang,
    record.metadata?.language
  ) || 'unknown';
}

function normalizeId(
  record: DatasetRecord,
  index: number
): string {
  const id = firstNonEmpty(
    record.id,
    record.doc_id,
    record.document_id
  );

  return id || `msmarco_xi_${index + 1}`;
}

function normalizeRecord(
  record: DatasetRecord,
  index: number
): RawDocument | null {
  const text = firstNonEmpty(
    record.text,
    record.passage,
    record.content
  );

  if (!text) {
    return null;
  }

  const title = firstNonEmpty(
    record.title,
    record.metadata?.title
  ) || `MSMARCO-XI Document ${index + 1}`;

  const query = firstNonEmpty(
    record.query,
    record.question,
    record.metadata?.query
  );

  const language = normalizeLanguage(record);

  const metadata: Record<string, unknown> = {
    ...(record.metadata || {}),
    source_dataset: 'ai4bharat/MSMARCO-XI',
    language,
  };

  return {
    id: normalizeId(record, index),
    title,
    text,
    language,
    source: 'msmarco-xi',
    query: query || undefined,
    metadata,
  };
}

function parseJsonFile(filePath: string): DatasetRecord[] {
  const raw = fs.readFileSync(filePath, 'utf-8').trim();

  if (!raw) {
    return [];
  }

  const parsed: unknown = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is DatasetRecord =>
        typeof item === 'object' &&
        item !== null
    );
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null
  ) {
    const obj = parsed as Record<string, unknown>;

    const possibleArrays = [
      obj.data,
      obj.records,
      obj.documents,
      obj.train,
    ];

    for (const candidate of possibleArrays) {
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is DatasetRecord =>
            typeof item === 'object' &&
            item !== null
        );
      }
    }
  }

  throw new Error(
    `Unsupported JSON dataset structure in ${filePath}`
  );
}

function parseJsonlFile(filePath: string): DatasetRecord[] {
  const lines = fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/);

  const records: DatasetRecord[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber].trim();

    if (!line) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(line);

      if (
        typeof parsed === 'object' &&
        parsed !== null
      ) {
        records.push(parsed as DatasetRecord);
      }
    } catch (error) {
      throw new Error(
        `Invalid JSONL at ${filePath}:${lineNumber + 1}`
      );
    }
  }

  return records;
}

function resolveDatasetPath(): string {
  const configuredPath = process.env.MSMARCO_XI_DATASET;

  if (configuredPath) {
    const absolutePath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);

    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }

    throw new Error(
      `MSMARCO_XI_DATASET points to a missing file: ${absolutePath}`
    );
  }

  const candidates = [
    DEFAULT_DATASET_PATH,

    path.resolve(
      process.cwd(),
      'data',
      'msmarco_xi.json'
    ),

    path.resolve(
      process.cwd(),
      'data',
      'msmarco_xi.jsonl'
    ),

    path.resolve(
      process.cwd(),
      'data',
      'processed',
      'msmarco_xi.jsonl'
    ),

    path.resolve(
      process.cwd(),
      'data',
      'processed',
      'msmarco_xi.json'
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      'MSMARCO-XI dataset file was not found.',
      '',
      'Expected one of:',
      ...candidates.map((file) => `  - ${file}`),
      '',
      'Or set:',
      '  MSMARCO_XI_DATASET=/path/to/msmarco_xi.jsonl',
    ].join('\n')
  );
}

function loadDatasetRecords(
  filePath: string
): DatasetRecord[] {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.jsonl') {
    return parseJsonlFile(filePath);
  }

  if (extension === '.json') {
    return parseJsonFile(filePath);
  }

  throw new Error(
    `Unsupported dataset format: ${extension}. Use .json or .jsonl.`
  );
}

/**
 * Loads and normalizes the actual local MSMARCO-XI dataset.
 *
 * targetDocCount:
 *   Maximum number of source records to use.
 *
 * Use 0 or a negative value to load all available records.
 */
export function loadMSMARCOXIDocuments(
  targetDocCount: number = 0
): RawDocument[] {
  const datasetPath = resolveDatasetPath();

  console.log(
    `[Dataset] Loading MSMARCO-XI from: ${datasetPath}`
  );

  const records = loadDatasetRecords(datasetPath);

  console.log(
    `[Dataset] Source records available: ${records.length.toLocaleString()}`
  );

  const limit =
    targetDocCount > 0
      ? Math.min(targetDocCount, records.length)
      : records.length;

  const documents: RawDocument[] = [];

  for (let i = 0; i < limit; i++) {
    const normalized = normalizeRecord(
      records[i],
      i
    );

    if (!normalized) {
      continue;
    }

    documents.push(normalized);
  }

  if (documents.length === 0) {
    throw new Error(
      'MSMARCO-XI dataset was loaded, but no usable text documents were found.'
    );
  }

  console.log(
    `[Dataset] Normalized documents: ${documents.length.toLocaleString()}`
  );

  const languageCounts: Record<string, number> = {};

  for (const document of documents) {
    languageCounts[document.language] =
      (languageCounts[document.language] || 0) + 1;
  }

  console.log(
    '[Dataset] Languages:',
    languageCounts
  );

  return documents;
}

/**
 * Backward-compatible function name used by the current
 * buildIndex.ts.
 *
 * IMPORTANT:
 * Unlike the old implementation, this function does NOT
 * generate fake documents.
 *
 * It loads records from the real local MSMARCO-XI dataset.
 */
export function generateProductionDocuments(
  targetDocCount: number = 2600
): RawDocument[] {
  return loadMSMARCOXIDocuments(
    targetDocCount
  );
}

/**
 * Returns basic information about the dataset without
 * changing the index.
 */
export function getDatasetInfo(): {
  path: string;
  records: number;
} {
  const datasetPath = resolveDatasetPath();

  const records = loadDatasetRecords(
    datasetPath
  );

  return {
    path: datasetPath,
    records: records.length,
  };
}