# Voice RAG Goa — Hacker House Goa 2026

An ultra-low-latency, voice-enabled extractive Retrieval-Augmented Generation (RAG) system built for **Hacker House Goa 2026 (Task 2)**. The system combines in-process dense vector retrieval (HNSW-style 384-dimensional embeddings), sparse BM25 lexical search, Reciprocal Rank Fusion (RRF), lightweight candidate reranking, multi-stage safety and grounding guardrails, and Sarvam AI Speech-to-Text (STT) on multilingual knowledge subsets derived from AI4Bharat MSMARCO-XI.

---

## 🌴 Architecture & Pipeline

```
                       [ User ]
                          │
          ┌───────────────┴───────────────┐
          │                               │
    [ Voice Audio ]                 [ Text Query ]
          │                               │
   (Sarvam AI STT)                        │
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
        [ Query Preprocessing & Safety Checks ]
                          │
                          ▼
            [ Fast Dense Embedding (384-dim) ]
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
  ┌───────────────────┐           ┌───────────────────┐
  │ HNSW Dense Search │           │ BM25 Sparse Search│
  │    (Top-20)       │           │    (Top-20)       │
  └─────────┬─────────┘           └─────────┬─────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
                [ Reciprocal Rank Fusion ]
                            │
                            ▼
              [ Lightweight Fast Reranker ]
                            │
                            ▼
             [ Evidence & Coverage Validation ]
                            │
                            ▼
               [ Extractive Grounded Answer ]
                            │
                            ▼
                 Answer + Grounded Sources
```

> **Note on Latency Isolation**: Text queries directly enter the in-process RAG pipeline. Voice queries pass through Sarvam AI STT first, with network transcription latency measured and reported independently from the in-process RAG retrieval and answer pipeline.

---

## ⚡ Core Design Principles & Why They Matter

### 1. Pure Extractive Answering (Zero LLM Bottleneck)
Rather than passing retrieved chunks to a generative LLM (which introduces token generation latencies of 500ms–2000ms and hallucination risks), our primary pipeline performs **grounded sentence extraction**. It identifies the exact high-confidence sentence spans within validated evidence passages that directly answer the query.

### 2. Hybrid Dense + Sparse Retrieval (HNSW + BM25)
- **HNSW Dense Retrieval**: Captures semantic intent, conceptual synonyms, and paraphrase variations.
- **BM25 Lexical Retrieval**: Delivers exact keyword, acronym, location name, and numeric matching.
- **Reciprocal Rank Fusion (RRF)**: Merges dense and sparse ranked lists using position-based harmonic scoring ($RRF(d) = \sum \frac{1}{k + r(d)}$), avoiding the instability of calibrating disparate score distributions.

### 3. Lightweight Reranking & Deduplication
The top RRF candidates undergo deterministic cross-attribute reranking (combining exact query term coverage, lexical overlap, title match, and rank positions) and parent document deduplication, condensing redundant chunks across strategies into unified, attribution-ready sources.

### 4. Multi-Stage Guardrails (Knowing When NOT to Answer)
The system verifies queries and evidence at multiple gates:
1. **Safety & Injection Guardrail**: Identifies prohibited topics, harmful commands, or prompt overrides.
2. **Off-Topic & Gibberish Guardrail**: Detects unparseable strings, empty inputs, or unsupported domains.
3. **Underspecified Query Guardrail**: Rejects overly ambiguous single-word or generic queries lacking actionable intent.
4. **Entity Match & Evidence Coverage Guardrail**: Validates that required named entities and key concepts exist in the retrieved passages before attempting extraction.
5. **Question-Type Compatibility Guardrail**: Ensures temporal, locational, biographical, or quantitative answers match the expected question format.
6. **Post-Extraction Grounding Guardrail**: Confirms extracted answer text is strictly supported by source passage tokens.

---

## 📚 Dataset: AI4Bharat MSMARCO-XI

This repository utilizes an indexed multilingual knowledge subset derived from the [AI4Bharat MSMARCO-XI dataset](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI), covering diverse domains including Geography, History, Science, Space (ISRO), Technology, Culture, Governance, and Indic Heritage.

### Data Architecture Breakdown

| Component | Description | Actual Repository Count |
|---|---|---|
| **Original Dataset Reference** | AI4Bharat MSMARCO-XI Multilingual Corpus | Benchmark Source |
| **Locally Indexed Documents** | Core domain documents ingested into memory | **2,600** documents |
| **Generated Knowledge Chunks** | Passages produced across 4 chunking strategies | **16,037** chunks |
| **Benchmark Query Suite** | Ground truth answerable + adversarial refusal queries | **100** measured queries |

---

## 🧩 4 Distinct Chunking Strategies

The ingestion pipeline (`backend/chunking/`) generates four complementary chunk representations for every document to optimize both broad thematic retrieval and granular sentence-level extraction:

1. **Fixed-Size Window (`fixed`)**: Slices text into uniform sliding windows with a fixed word count and overlapping boundary stride. Provides reliable baseline coverage for dense vector search.
2. **Sentence-Aware (`sentence`)**: Groups full sentences using multilingual punctuation boundaries (`.`, `?`, `!`, `।`, `॥`), preventing mid-sentence clipping and preserving grammatical integrity.
3. **Semantic Coherence (`semantic`)**: Splits text along natural paragraph breaks and discourse transition markers, maintaining cohesive topical context within each passage.
4. **Metadata-Aware / Structured (`metadata`)**: Preserves document structural headers, section titles, and hierarchical tags, ensuring parent topic context is indexed alongside body content.

---

## ⏱️ Latency & Performance Measurement

### Latency Boundary Definition
- **In-Process RAG Latency**: Measures everything from query normalization, 384-dim dense embedding, HNSW search, BM25 lookup, RRF fusion, candidate reranking, guardrail validation, to extractive answer selection.
- **Voice STT Latency**: Measures audio transfer and transcription roundtrip with Sarvam AI (`saaras:v3`). This network/API latency is logged as a distinct telemetry metric (`stt_latency_ms`) and is **never** conflated with in-process RAG time.

### Benchmark Results (Fresh 100-Query Run)

The benchmark harness (`scripts/benchmark.ts`) executes 3 warm-up queries followed by 100 deterministic evaluation queries spanning all topic categories and adversarial refusal cases.

*Results captured from the latest verified benchmark run (`data/benchmark_results.json`):*

| Metric | Measured Value |
|---|---:|
| **Evaluation Queries** | 100 |
| **Warm-Up Queries** | 3 |
| **P50 Latency** | **6.88 ms** |
| **P70 Latency** | **7.43 ms** |
| **P100 (Max) Latency** | **13.06 ms** |
| **Mean Latency** | **6.79 ms** |
| **Min Latency** | **0.00 ms** (Cached / Instant Safety Guardrail) |
| **Grounded Answers (Answerable)** | **91 / 91 (100%)** |
| **Correct Refusals (Adversarial)** | **9 / 9 (100%)** |
| **Overall Pipeline Accuracy** | **100%** |

### Per-Stage Latency Breakdown (Averages)

| Pipeline Stage | Average Latency |
|---|---:|
| Query Preprocessing & Normalization | 0.036 ms |
| Fast Dense Embedding Generation | 0.047 ms |
| Dense Vector Search (HNSW Top-20) | 4.670 ms |
| Sparse BM25 Search (Top-20) | 0.984 ms |
| Reciprocal Rank Fusion (RRF) | 0.032 ms |
| Lightweight Reranking | 0.763 ms |
| Guardrail & Coverage Validation | 0.101 ms |
| Grounded Answer Extraction | 0.148 ms |
| Post-Answer Grounding Verification | 0.006 ms |
| **Total In-Process Pipeline Mean** | **6.794 ms** |

---

## 🎙️ Speech-to-Text Integration (Sarvam AI)

Voice input is powered by Sarvam AI (`saaras:v3` model):
- **Audio Capture**: Captures 16kHz WAV / WebM audio via the browser MediaRecorder API.
- **REST Transcription Endpoint**: `POST /api/transcribe` processes multipart audio payloads and returns transcript text, detected language, and isolated STT latency.
- **WebSocket Streaming Support**: `ws://localhost:3000/api/stt/stream` provides live binary chunk streaming to Sarvam's WebSocket gateway for incremental transcription.
- **Graceful Fallback**: If `SARVAM_API_KEY` is not provided in `.env`, the system signals fallback readiness while keeping all text and RAG capabilities fully operational.

---

## 🛡️ Guardrails & Refusal Behavior

The pipeline implements strict validation to refuse unanswerable, harmful, or out-of-domain queries:

- **Refuses Harmful or Prohibited Queries**: Rejects prompts requesting dangerous or illicit actions before reaching retrieval.
- **Refuses Off-Topic & Prompt Injection**: Rejects gibberish, empty strings, or meta-instruction attacks.
- **Refuses Underspecified Queries**: Rejects vague single-token inputs lacking sufficient query intent.
- **Refuses Entity Mismatches**: Rejects queries when retrieved evidence lacks the specific entities requested.
- **Refuses Insufficient Evidence**: Refuses to answer when the corpus lacks verifiable facts, preventing ungrounded speculation.

---

## 💻 Tech Stack

- **Backend Runtime**: Node.js 20+ with TypeScript (`tsx`), Express 4, and native `perf_hooks` telemetry.
- **Retrieval Engine**: Custom in-process HNSW dense vector index + inverted BM25 index with RRF fusion.
- **Voice STT**: Sarvam AI REST (`https://api.sarvam.ai/speech-to-text`) & WebSocket streaming.
- **Frontend UI**: React 19, Vite, Tailwind CSS, Lucide Icons, and Motion animations styled with a retro-tropical Hacker House Goa aesthetic.

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── chunking/          # 4 chunking strategies (fixed, sentence, semantic, metadata)
│   ├── guardrails/        # Safety, off-topic, coverage, and grounding guardrails
│   ├── ingestion/         # MSMARCO-XI dataset loader & index builder
│   ├── rag/               # Extractive RAG pipeline & sentence span extractor
│   ├── retrieval/         # HNSW dense index, BM25 sparse index, RRF, reranker
│   └── services/          # Sarvam STT service, WebSocket gateway, benchmark runner
├── data/
│   ├── benchmark_results.json  # Latest verified 100-query benchmark report
│   └── processed/              # Serialized vector, BM25, and chunk indexes
├── scripts/
│   ├── benchmark.ts       # CLI benchmark runner
│   ├── build-index.ts     # Index generation script
│   ├── ingest.ts          # Dataset ingestion script
│   └── test-all.ts        # Unit and integration test suite
├── src/
│   ├── components/        # React components (VoiceRecorder, AnswerCard, Benchmark, etc.)
│   ├── App.tsx            # Main application UI shell
│   └── main.tsx           # React entry point
├── Dockerfile             # Multi-stage production container build
├── server.ts              # Express API & Vite dev/prod server
├── package.json           # Scripts and dependencies
└── .env.example           # Environment variable template
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd voice-rag-goa
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and provide your Sarvam AI API key (optional for text-only / simulated STT):
```bash
cp .env.example .env
```
```env
SARVAM_API_KEY="your_sarvam_api_key_here"
PORT=3000
APP_URL="http://localhost:3000"
```

### 4. Build Dataset Indexes
Ingest the MSMARCO-XI subset and compile the vector and BM25 indexes:
```bash
npm run ingest
```

### 5. Run Verification Test Suite
Execute the end-to-end test suite covering chunking, retrieval, fusion, guardrails, and latency:
```bash
npm test
```

### 6. Run 100-Query Latency Benchmark
Execute the automated 100-query benchmark from the command line:
```bash
npm run benchmark
```

### 7. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 8. Production Build & Execution
```bash
npm run build
npm start
```

---

## 🐳 Docker Deployment

The repository includes a multi-stage `Dockerfile` configured for containerized deployment:

```bash
# Build production container image
docker build -t voice-rag-goa .

# Run container on port 3000
docker run -p 3000:3000 --env-file .env voice-rag-goa
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check, chunk count, index readiness, and STT status |
| `POST` | `/api/query` | Executes RAG pipeline for `{ query, chunk_strategy }` |
| `POST` | `/api/transcribe` | Transcribes audio via Sarvam AI STT with isolated `stt_latency_ms` |
| `GET` | `/api/chunks` | Paginated exploration of indexed chunks with keyword search |
| `POST` | `/api/benchmark/run` | Triggers a 100-query benchmark run |
| `GET` | `/api/benchmark/stream` | Server-Sent Events (SSE) stream of real-time benchmark execution |
| `GET` | `/api/benchmark/latest` | Retrieves latest verified benchmark results |

---

## 🎯 How This Project Meets Hacker House Goa 2026 (Task 2)

| Task 2 Requirement | Repository Implementation |
|---|---|
| **Speech-to-Text** | Sarvam AI STT (`saaras:v3`) via REST (`/api/transcribe`) and streaming WebSocket |
| **Multiple Chunking Strategies** | 4 strategies: Fixed-size window, Sentence-aware, Semantic coherence, and Metadata-aware |
| **Vector Retrieval** | Custom in-process HNSW dense vector index with 384-dimensional embeddings |
| **Sparse Retrieval** | Inverted BM25 term frequency / inverse document frequency index |
| **Hybrid Fusion** | Reciprocal Rank Fusion ($k=60$) combining dense and sparse candidate rankings |
| **Sub-200ms Target** | In-process RAG pipeline executes in **< 15ms** (P50: 6.88ms, P100: 13.06ms) |
| **Grounded Answering** | High-precision sentence span extraction from validated source passages (Zero hallucinations) |
| **Guardrails & Refusals** | Multi-gate validation rejecting unsafe, off-topic, underspecified, or unsupported queries |
| **Automated Benchmark Harness** | 100-query evaluation with P50/P70/P100 percentiles, stage breakdowns, and live SSE streaming |

---

## 🔍 What We Do Not Claim

- **Complete MSMARCO-XI Ingestion**: We do not claim the entirety of the tens of gigabytes of raw MSMARCO-XI was loaded into memory. We index a curated, high-density subset of 2,600 multi-domain documents yielding 16,037 chunks across 4 strategies.
- **Sub-200ms Full Voice Trip Including Remote Network STT**: While in-process RAG executes in under 15ms, remote STT transcription over public internet connections depends on network roundtrip time and Sarvam API latency. These metrics are transparently separated.
- **Generative LLM Synthesis**: We intentionally do not use a generative LLM on the fast answer path, avoiding 500ms+ token generation delays and hallucination risks.

---

## 🔒 Security Best Practices

- **Never Commit Secrets**: Keep `SARVAM_API_KEY` strictly inside `.env` (ignored by `.gitignore`).
- **Input Validation**: All query and audio inputs undergo schema and size validation before processing.
- **Read-Only Data Runtime**: Ingested indexes and chunks operate in-memory with strict boundary checks.

---

Built for **Hacker House Goa 2026**.
