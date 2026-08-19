import express from 'express';
import http from 'http';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { Chunk } from './backend/chunking/types.js';
import { VectorIndex } from './backend/retrieval/hnsw.js';
import { BM25Index } from './backend/retrieval/bm25.js';
import { RAGPipeline } from './backend/rag/pipeline.js';
import { STTService } from './backend/services/stt.js';
import { BenchmarkRunner } from './backend/services/benchmark.js';
import { setupSTTWebSocketServer } from './backend/services/sttSocket.js';

dotenv.config();

const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined'
      ? __dirname
      : process.cwd();
  }
};

const _dirname = getDirname();

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const PORT =
    Number(process.env.PORT) || 3000;

  const upload =
    multer({
      storage: multer.memoryStorage(),
    });

  app.use(express.json());

  // ----------------------------------------------------------
  // REAL-TIME STT WEBSOCKET
  // ----------------------------------------------------------

  setupSTTWebSocketServer(server);

  // ----------------------------------------------------------
  // RUNTIME STATE
  // ----------------------------------------------------------

  let chunks: Chunk[] = [];

  let vectorIndex =
    new VectorIndex();

  let bm25Index =
    new BM25Index();

  let pipeline: RAGPipeline;

  const sttService =
    new STTService();

  let benchmarkRunner:
    BenchmarkRunner | null = null;

  // ----------------------------------------------------------
  // LOAD REAL INDEXES ONLY
  // ----------------------------------------------------------

  function loadIndexes() {
    const processedDir =
      path.resolve(
        process.cwd(),
        'data',
        'processed'
      );

    const chunksPath =
      path.join(
        processedDir,
        'chunks.json'
      );

    const vectorPath =
      path.join(
        processedDir,
        'vector_index.json'
      );

    const bm25Path =
      path.join(
        processedDir,
        'bm25_index.json'
      );

    console.log(
      '[Server Startup] Loading real MSMARCO-XI artifacts...'
    );

    // --------------------------------------------------------
    // HARD REQUIREMENT:
    // Never regenerate the dataset at server startup.
    // --------------------------------------------------------

    const missing: string[] = [];

    if (!fs.existsSync(chunksPath)) {
      missing.push(chunksPath);
    }

    if (!fs.existsSync(vectorPath)) {
      missing.push(vectorPath);
    }

    if (!fs.existsSync(bm25Path)) {
      missing.push(bm25Path);
    }

    if (missing.length > 0) {
      throw new Error(
        [
          'REAL INDEX ARTIFACTS ARE MISSING.',
          '',
          ...missing.map(
            file => `Missing: ${file}`
          ),
          '',
          'Run the local index-building pipeline first.',
          'The server will NOT generate synthetic data automatically.',
        ].join('\n')
      );
    }

    try {
      console.log(
        '[Server Startup] Reading chunks.json...'
      );

      chunks =
        JSON.parse(
          fs.readFileSync(
            chunksPath,
            'utf-8'
          )
        );

      console.log(
        `[Server Startup] Loaded ${chunks.length.toLocaleString()} chunks.`
      );

      console.log(
        '[Server Startup] Reading HNSW index...'
      );

      const vectorData =
        JSON.parse(
          fs.readFileSync(
            vectorPath,
            'utf-8'
          )
        );

      vectorIndex =
        VectorIndex.deserialize(
          vectorData
        );

      console.log(
        `[Server Startup] Loaded ${vectorIndex.size.toLocaleString()} vectors.`
      );

      console.log(
        '[Server Startup] Reading BM25 index...'
      );

      const bm25Data =
        JSON.parse(
          fs.readFileSync(
            bm25Path,
            'utf-8'
          )
        );

      bm25Index =
        BM25Index.deserialize(
          bm25Data
        );

      console.log(
        `[Server Startup] Loaded ${bm25Index.size.toLocaleString()} BM25 documents.`
      );

    } catch (error) {
      throw new Error(
        `Failed to load real MSMARCO-XI indexes: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }

    // --------------------------------------------------------
    // HARD DATA VALIDATION
    // --------------------------------------------------------

    if (chunks.length !== 20_000) {
      throw new Error(
        `Invalid corpus size: expected 20,000 chunks, got ${chunks.length}.`
      );
    }

    const hindiCount =
      chunks.filter(
        c => c.language === 'hi'
      ).length;

    const englishCount =
      chunks.filter(
        c => c.language === 'en'
      ).length;

    if (hindiCount !== 10_000) {
      throw new Error(
        `Invalid Hindi corpus size: expected 10,000, got ${hindiCount}.`
      );
    }

    if (englishCount !== 10_000) {
      throw new Error(
        `Invalid English corpus size: expected 10,000, got ${englishCount}.`
      );
    }

    if (vectorIndex.size !== 20_000) {
      throw new Error(
        `Invalid HNSW size: expected 20,000, got ${vectorIndex.size}.`
      );
    }

    if (bm25Index.size !== 20_000) {
      throw new Error(
        `Invalid BM25 size: expected 20,000, got ${bm25Index.size}.`
      );
    }

    // --------------------------------------------------------
    // CREATE RAG PIPELINE
    // --------------------------------------------------------

    pipeline =
      new RAGPipeline(
        chunks,
        vectorIndex,
        bm25Index
      );

    benchmarkRunner =
      new BenchmarkRunner(
        pipeline,
        chunks
      );

    console.log(
      '============================================================'
    );

    console.log(
      '[Server Ready] REAL MSMARCO-XI CORPUS ACTIVE'
    );

    console.log(
      `Hindi   : ${hindiCount.toLocaleString()}`
    );

    console.log(
      `English : ${englishCount.toLocaleString()}`
    );

    console.log(
      `Chunks  : ${chunks.length.toLocaleString()}`
    );

    console.log(
      `HNSW    : ${vectorIndex.size.toLocaleString()}`
    );

    console.log(
      `BM25    : ${bm25Index.size.toLocaleString()}`
    );

    console.log(
      '============================================================'
    );
  }

  const serverStartTime =
    new Date().toISOString();

  // ----------------------------------------------------------
  // LOAD REAL INDEXES ON STARTUP
  // ----------------------------------------------------------

  loadIndexes();

  // ----------------------------------------------------------
  // 1. HEALTH
  // ----------------------------------------------------------

  app.get(
    '/api/health',
    (_req, res) => {
      const docIds =
        new Set<string>();

      for (const chunk of chunks) {
        if (chunk.doc_id) {
          docIds.add(
            chunk.doc_id
          );
        }
      }

      const isReady =
        chunks.length === 20_000 &&
        vectorIndex.size === 20_000 &&
        bm25Index.size === 20_000;

      res.json({
        status:
          isReady
            ? 'ok'
            : 'initializing',

        ready: isReady,

        dataset_loaded:
          chunks.length > 0,

        document_count:
          docIds.size,

        chunk_count:
          chunks.length,

        chunks:
          chunks.length,

        index_loaded:
          vectorIndex.size > 0 &&
          bm25Index.size > 0,

        embedding_dimension:
          128,

        hnsw_loaded:
          vectorIndex.size > 0,

        bm25_loaded:
          bm25Index.size > 0,

        vector_index_loaded:
          vectorIndex.size > 0,

        index_version:
          benchmarkRunner?.getDatasetSignature() ||
          'msmarco-xi-20k',

        startup_time:
          serverStartTime,

        uptime_seconds:
          Math.floor(
            process.uptime()
          ),

        retrieval_mode:
          'hnsw_bm25_rrf',

        llm_enabled:
          false,

        stt_configured:
          sttService.isConfigured(),

        environment:
          process.env.NODE_ENV ||
          'development',
      });
    }
  );

  // ----------------------------------------------------------
  // 2. QUERY
  // ----------------------------------------------------------

  app.post(
    '/api/query',
    async (req, res) => {
      try {
        const {
          query,
          chunk_strategy,
        } = req.body;

        if (
          !query ||
          typeof query !== 'string'
        ) {
          return res
            .status(400)
            .json({
              error:
                'Query string is required.',
            });
        }

        const response =
          await pipeline.execute(
            query,
            chunk_strategy
          );

        return res.json(
          response
        );

      } catch (err: any) {
        console.error(
          'Error executing query:',
          err
        );

        return res
          .status(500)
          .json({
            error:
              err.message ||
              'Internal RAG pipeline error',
          });
      }
    }
  );

  // ----------------------------------------------------------
  // 3. TRANSCRIPTION
  // ----------------------------------------------------------

 app.post(
  '/api/transcribe',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as
        | {
            audio?: Express.Multer.File[];
            file?: Express.Multer.File[];
          }
        | undefined;

      // Accept both field names for compatibility
      const uploadedFile =
        files?.audio?.[0] ||
        files?.file?.[0];

      let audioBuffer: Buffer;
      let mimeType = 'audio/wav';

      if (uploadedFile) {
        audioBuffer = uploadedFile.buffer;
        mimeType =
          uploadedFile.mimetype || 'audio/wav';
      } else if (
        req.body &&
        req.body.audioBase64
      ) {
        audioBuffer = Buffer.from(
          req.body.audioBase64,
          'base64'
        );

        mimeType =
          req.body.mimeType || 'audio/wav';
      } else {
        return res.status(400).json({
          error: 'No audio provided in request.',
        });
      }

     
        const languageCode =
          (req.body &&
            req.body.language) ||
          'unknown';

        const result =
          await sttService.transcribeAudio(
            audioBuffer,
            mimeType,
            languageCode
          );

        return res.json(
          result
        );

      } catch (err: any) {
        console.error(
          'Error in STT transcription:',
          err
        );

        return res
          .status(500)
          .json({
            error:
              err.message ||
              'STT transcription failed.',
          });
      }
    }
  );

  // ----------------------------------------------------------
  // 4. DATASET EXPLORER
  // ----------------------------------------------------------

  app.get(
    '/api/chunks',
    (req, res) => {
      const page =
        Math.max(
          1,
          parseInt(
            req.query.page as string,
            10
          ) || 1
        );

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              req.query.limit as string,
              10
            ) || 20
          )
        );

      const strategy =
        (req.query.strategy as string) ||
        '';

      const search =
        (
          (req.query.search as string) ||
          ''
        ).toLowerCase();

      let filtered =
        chunks;

      if (
        strategy &&
        strategy !== 'all'
      ) {
        filtered =
          filtered.filter(
            chunk =>
              chunk.strategy ===
              strategy
          );
      }

      if (search) {
        filtered =
          filtered.filter(
            chunk =>
              chunk.text
                .toLowerCase()
                .includes(search) ||
              (
                chunk.title &&
                chunk.title
                  .toLowerCase()
                  .includes(search)
              )
          );
      }

      const total =
        filtered.length;

      const startIdx =
        (page - 1) * limit;

      const paginatedChunks =
        filtered.slice(
          startIdx,
          startIdx + limit
        );

      const strategyCounts:
        Record<string, number> = {
          fixed: 0,
          sentence: 0,
          semantic: 0,
          metadata: 0,
        };

      for (const chunk of chunks) {
        strategyCounts[
          chunk.strategy
        ] =
          (
            strategyCounts[
              chunk.strategy
            ] || 0
          ) + 1;
      }

      return res.json({
        total,
        page,
        limit,

        totalPages:
          Math.ceil(
            total / limit
          ),

        strategyCounts,

        chunks:
          paginatedChunks,
      });
    }
  );

  // ----------------------------------------------------------
  // 5. BENCHMARK INFO
  // ----------------------------------------------------------

  app.get(
    '/api/benchmark/dataset-info',
    (_req, res) => {
      if (!benchmarkRunner) {
        benchmarkRunner =
          new BenchmarkRunner(
            pipeline,
            chunks
          );
      }

      return res.json(
        benchmarkRunner.getDatasetStats()
      );
    }
  );

  // ----------------------------------------------------------
  // 6. BENCHMARK RUN
  // ----------------------------------------------------------

  app.post(
    '/api/benchmark/run',
    async (req, res) => {
      try {
        const count =
          Math.min(
            200,
            Math.max(
              5,
              parseInt(
                req.body.count,
                10
              ) || 100
            )
          );

        if (!benchmarkRunner) {
          benchmarkRunner =
            new BenchmarkRunner(
              pipeline,
              chunks
            );
        }

        const report =
          await benchmarkRunner.runBenchmark(
            count,
            3
          );

        return res.json(
          report
        );

      } catch (err: any) {
        console.error(
          'Error running benchmark:',
          err
        );

        return res
          .status(500)
          .json({
            error:
              err.message ||
              'Benchmark run failed',
          });
      }
    }
  );

  // ----------------------------------------------------------
  // 7. BENCHMARK STREAM
  // ----------------------------------------------------------

  app.get(
    '/api/benchmark/stream',
    async (req, res) => {
      res.setHeader(
        'Content-Type',
        'text/event-stream'
      );

      res.setHeader(
        'Cache-Control',
        'no-cache'
      );

      res.setHeader(
        'Connection',
        'keep-alive'
      );

      const count =
        Math.min(
          200,
          Math.max(
            5,
            parseInt(
              req.query.count as string,
              10
            ) || 100
          )
        );

      if (!benchmarkRunner) {
        benchmarkRunner =
          new BenchmarkRunner(
            pipeline,
            chunks
          );
      }

      try {
        const report =
          await benchmarkRunner.runBenchmark(
            count,
            3,
            42,
            progress => {
              res.write(
                `data: ${JSON.stringify({
                  type: 'progress',
                  ...progress,
                })}\n\n`
              );
            }
          );

        res.write(
          `data: ${JSON.stringify({
            type: 'complete',
            benchmark: report,
          })}\n\n`
        );

        res.end();

      } catch (err: any) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            error:
              err.message ||
              'Benchmark failed',
          })}\n\n`
        );

        res.end();
      }
    }
  );

  // ----------------------------------------------------------
  // 8. LATEST BENCHMARK
  // ----------------------------------------------------------

  app.get(
    '/api/benchmark/latest',
    (_req, res) => {
      const resultPath =
        path.resolve(
          process.cwd(),
          'data',
          'benchmark_results.json'
        );

      if (
        fs.existsSync(
          resultPath
        )
      ) {
        try {
          const data =
            JSON.parse(
              fs.readFileSync(
                resultPath,
                'utf-8'
              )
            );

          const currentSignature =
            benchmarkRunner?.getDatasetSignature();

          if (
            !currentSignature ||
            data.dataset_signature ===
              currentSignature
          ) {
            return res.json(
              data
            );
          }

        } catch {}
      }

      return res.json({
        status:
          'no_benchmark_run_yet',
      });
    }
  );

  // ----------------------------------------------------------
  // FRONTEND
  // ----------------------------------------------------------

  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode:
            true,
        },

        appType: 'spa',
      });

    app.use(
      vite.middlewares
    );

  } else {
   const distPath =
  path.resolve(
    _dirname,
    '../dist'
  );
    if (
      fs.existsSync(
        distPath
      )
    ) {
      app.use(
        express.static(
          distPath
        )
      );

      app.get(
        '*',
        (_req, res) => {
          res.sendFile(
            path.join(
              distPath,
              'index.html'
            )
          );
        }
      );
    }
  }

  // ----------------------------------------------------------
  // START SERVER
  // ----------------------------------------------------------

  server.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `🚀 Voice RAG Server listening on http://0.0.0.0:${PORT}`
      );
    }
  );
}

startServer().catch(
  err => {
    console.error(
      'Fatal error during server startup:',
      err
    );

    process.exit(1);
  }
);