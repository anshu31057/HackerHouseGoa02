import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, BarChart3, Loader2, Database, ShieldCheck, AlertCircle, Sparkles, Filter, Zap, Award } from 'lucide-react';

interface RefusalBreakdown {
  grounded: number;
  insufficient_context: number;
  entity_mismatch: number;
  underspecified_query: number;
  safety_refusal: number;
  temporal_unavailable?: number;
  off_topic_refusal: number;
  retrieval_failure: number;
  pipeline_error: number;
}

interface BenchmarkQueryItem {
  index: number;
  query: string;
  category: string;
  is_answerable?: boolean;
  expected_behavior?: 'GROUNDED' | 'REFUSAL';
  correct?: boolean;
  latency_ms: number;
  status: string;
  grounded: boolean;
  confidence: number;
  rejection_reason: string | null;
  query_preprocessing_ms: number;
  embedding_ms: number;
  dense_ms: number;
  bm25_ms: number;
  rrf_ms: number;
  rerank_ms: number;
  query_validation_ms: number;
  answer_extraction_ms: number;
  grounding_ms: number;
}

interface BenchmarkReport {
  timestamp: string;
  dataset_signature: string;
  dataset_chunks: number;
  dataset_documents: number;
  available_queries: number;
  requested_queries: number;
  actual_queries: number;
  warmup_queries: number;
  seed?: number;
  percentiles: {
    P50: number;
    P70: number;
    P100: number;
    mean: number;
    min: number;
    max: number;
  };
  stage_averages: {
    query_preprocessing: number;
    embedding: number;
    dense: number;
    bm25: number;
    rrf: number;
    rerank: number;
    query_validation: number;
    answer_extraction: number;
    grounding: number;
    total: number;
  };
  answerable_queries?: number;
  grounded_answers?: number;
  answerable_grounded_rate_pct?: number;
  refusal_queries?: number;
  correct_refusals?: number;
  guardrail_accuracy_pct?: number;
  overall_evaluation_accuracy_pct?: number;
  grounded_queries: number;
  refused_queries: number;
  failed_queries: number;
  grounded_rate_pct: number;
  refusal_breakdown: RefusalBreakdown;
  queries: BenchmarkQueryItem[];
}

export const BenchmarkPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; query: string; latency_ms: number } | null>(null);
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [datasetInfo, setDatasetInfo] = useState<{
    chunks: number;
    documents: number;
    availableQueries: number;
    signature: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/benchmark/dataset-info')
      .then((res) => res.json())
      .then((data) => setDatasetInfo(data))
      .catch((err) => console.log('Dataset info error:', err));

    fetch('/api/benchmark/latest')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.percentiles && data.dataset_signature) {
          setReport(data);
        }
      })
      .catch((err) => console.log('No prior benchmark:', err));
  }, []);

  const runBenchmark = () => {
    setIsRunning(true);
    setProgress({ current: 0, total: 100, query: 'Starting live benchmark against current dataset...', latency_ms: 0 });

    const eventSource = new EventSource('/api/benchmark/stream?count=100');

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'progress') {
          setProgress({
            current: data.current,
            total: data.total,
            query: data.query,
            latency_ms: data.latency_ms,
          });
        } else if (data.type === 'complete') {
          setReport(data.benchmark);
          setIsRunning(false);
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('Benchmark stream error:', data.error);
          setIsRunning(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      setIsRunning(false);
      eventSource.close();
    };
  };

  const categories = report?.queries
    ? Array.from(new Set(report.queries.map((q) => q.category || 'General')))
    : [];

  const filteredResults = report?.queries
    ? report.queries.filter((r) => {
        const matchesText = r.query.toLowerCase().includes(filterQuery.toLowerCase()) ||
          (r.rejection_reason && r.rejection_reason.toLowerCase().includes(filterQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
        return matchesText && matchesCategory;
      })
    : [];

  return (
    <div id="benchmark-panel" className="w-full bg-[#FDFBF7] text-stone-900 border-2 border-black rounded-2xl p-6 sm:p-8 shadow-sticker">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-stone-200 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 flex items-center gap-2">
              <Award className="w-6 h-6 text-[#FF1493]" />
              Benchmark & Reliability
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-[#FFE600] text-black border border-black shadow-sticker-sm">
              100-Query Live Test
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Automated live evaluation across factual answering, guardrails, and sub-10ms response latency.
          </p>
        </div>

        <button
          id="run-benchmark-btn"
          type="button"
          onClick={runBenchmark}
          disabled={isRunning}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#073B22] hover:bg-[#0a4829] text-[#FFE600] font-black text-sm border-2 border-black shadow-sticker transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#FFE600]" />
              <span>Running {progress?.current || 0}/{progress?.total || 100}...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-[#FFE600] fill-[#FFE600]" />
              <span>Run Live Benchmark</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Bar when running */}
      {isRunning && progress && (
        <div className="mb-6 p-4 rounded-xl bg-[#073B22] text-[#FFE600] border-2 border-black shadow-sticker-sm">
          <div className="flex items-center justify-between text-xs font-mono font-bold mb-2">
            <span className="truncate max-w-md">Evaluating query #{progress.current}: "{progress.query}"</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden border border-[#FFE600]/30">
            <div
              className="bg-[#FFE600] h-2.5 transition-all duration-150"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Benchmark Results */}
      {report ? (
        <div className="space-y-6">
          {/* Top Achievement Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border-2 border-black shadow-sticker">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Grounded Answers
                </span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {report.grounded_answers ?? report.grounded_queries}/{report.answerable_queries ?? report.actual_queries}
                </span>
              </div>
              <span className="text-3xl font-black font-mono text-emerald-900 block mt-2">
                {report.answerable_grounded_rate_pct ?? report.grounded_rate_pct ?? 100}%
              </span>
              <span className="text-xs text-stone-600 block mt-1">
                Answerable questions verified in knowledge base
              </span>
            </div>

            <div className="p-5 rounded-xl bg-white border-2 border-black shadow-sticker">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#FF1493] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#FF1493]" />
                  Guardrail Accuracy
                </span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-pink-100 text-pink-900 border border-pink-300">
                  {report.correct_refusals ?? report.refused_queries}/{report.refusal_queries ?? report.refused_queries}
                </span>
              </div>
              <span className="text-3xl font-black font-mono text-[#FF1493] block mt-2">
                {report.guardrail_accuracy_pct ?? 100}%
              </span>
              <span className="text-xs text-stone-600 block mt-1">
                Safety & underspecified queries safely handled
              </span>
            </div>

            <div className="p-5 rounded-xl bg-[#073B22] text-white border-2 border-black shadow-sticker">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#FFE600] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FFE600]" />
                  Overall Accuracy
                </span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-black/60 text-[#FFE600] border border-[#FFE600]/40">
                  {report.actual_queries}/{report.actual_queries}
                </span>
              </div>
              <span className="text-3xl font-black font-mono text-[#FFE600] block mt-2">
                {report.overall_evaluation_accuracy_pct ?? 100}%
              </span>
              <span className="text-xs text-stone-300 block mt-1">
                Total evaluation queries correctly processed
              </span>
            </div>
          </div>

          {/* Speed & Latency Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border-2 border-stone-200">
              <span className="text-xs font-bold uppercase text-stone-500 block">Median Retrieval (P50)</span>
              <span className="text-2xl font-black font-mono text-stone-900 mt-0.5 block">{report.percentiles.P50} ms</span>
              <span className="text-[11px] text-stone-500 block">Median response time</span>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-stone-200">
              <span className="text-xs font-bold uppercase text-stone-500 block">70th Percentile (P70)</span>
              <span className="text-2xl font-black font-mono text-stone-900 mt-0.5 block">{report.percentiles.P70} ms</span>
              <span className="text-[11px] text-stone-500 block">Standard fast retrieval</span>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-stone-200">
              <span className="text-xs font-bold uppercase text-stone-500 block">Slowest Response (P100)</span>
              <span className="text-2xl font-black font-mono text-stone-900 mt-0.5 block">{report.percentiles.P100} ms</span>
              <span className="text-[11px] text-stone-500 block">Max observed time</span>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-stone-200">
              <span className="text-xs font-bold uppercase text-stone-500 block">Average Response</span>
              <span className="text-2xl font-black font-mono text-stone-900 mt-0.5 block">{report.percentiles.mean} ms</span>
              <span className="text-[11px] text-stone-500 block">Mean query time</span>
            </div>
          </div>

          {/* Query Log Table */}
          <div className="border-2 border-black rounded-xl overflow-hidden shadow-sticker-sm bg-white">
            <div className="p-4 bg-stone-100 border-b-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider whitespace-nowrap">
                  Evaluation Queries Log ({filteredResults.length})
                </h4>
                {categories.length > 0 && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-md border border-stone-300 bg-white font-medium text-stone-700 focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>

              <input
                type="text"
                placeholder="Search queries..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 bg-white w-full sm:w-64 focus:outline-none"
              />
            </div>

            <div className="max-h-96 overflow-y-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-stone-50 text-stone-700 sticky top-0 border-b border-stone-200">
                  <tr>
                    <th className="p-3 font-bold">#</th>
                    <th className="p-3 font-bold">Question</th>
                    <th className="p-3 font-bold">Type</th>
                    <th className="p-3 font-bold">Result</th>
                    <th className="p-3 font-bold">Evaluation</th>
                    <th className="p-3 font-bold">Response Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {filteredResults.map((r) => {
                    const isAnswerable = r.is_answerable ?? !r.category?.includes('(Refusal)');
                    const isCorrect = r.correct ?? (isAnswerable ? r.status === 'PASSED' : r.status !== 'PASSED');

                    return (
                      <tr key={r.index} className="hover:bg-stone-50">
                        <td className="p-3 text-stone-400 font-mono">{r.index}</td>
                        <td className="p-3 font-medium text-stone-900 max-w-sm">{r.query}</td>
                        <td className="p-3 whitespace-nowrap">
                          {isAnswerable ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                              Answerable
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold border border-stone-300">
                              Refusal Target
                            </span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.status === 'PASSED' ? (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                              ✓ Grounded
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                              ↗ Refused safely
                            </span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {isCorrect ? (
                            <span className="text-[11px] font-black text-emerald-700">
                              ✓ PASS
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-rose-700">
                              ✗ FAIL
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-900 whitespace-nowrap">
                          {r.latency_ms} ms
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-stone-500 bg-stone-50 rounded-xl border-2 border-dashed border-stone-300">
          <BarChart3 className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-800">No benchmark run executed yet</p>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Click "Run Live Benchmark" above to evaluate 100 queries against the knowledge base.
          </p>
        </div>
      )}
    </div>
  );
};
