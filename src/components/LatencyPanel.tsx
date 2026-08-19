import React from 'react';
import { Zap, Clock, Cpu, Mic } from 'lucide-react';

export interface Latencies {
  query_processing: number;
  embedding: number;
  dense_retrieval: number;
  bm25_retrieval: number;
  rrf: number;
  reranking: number;
  query_validation?: number;
  answer_extraction?: number;
  grounding: number;
  total_rag: number;
}

interface LatencyPanelProps {
  latencies?: Latencies | null;
  sttLatencyMs?: number | null;
}

export const LatencyPanel: React.FC<LatencyPanelProps> = ({ latencies, sttLatencyMs }) => {
  if (!latencies) return null;

  return (
    <div id="latency-panel" className="w-full bg-[#FDFBF7] text-stone-900 border-2 border-black rounded-2xl p-6 sm:p-8 shadow-sticker">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b-2 border-stone-200">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#FFE600] fill-black stroke-black" />
          <span>Execution Performance</span>
        </h3>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
          In-Process Ultra Low Latency
        </span>
      </div>

      {/* Main KPI badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {sttLatencyMs !== null && sttLatencyMs !== undefined && (
          <div className="p-4 rounded-xl bg-white border-2 border-black shadow-sticker-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#FF1493]" />
                Voice Recognition (STT)
              </span>
              <span className="text-2xl font-mono font-black text-stone-900 mt-1 block">
                {sttLatencyMs.toFixed(0)} ms
              </span>
            </div>
            <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-1 rounded">
              Sarvam AI
            </span>
          </div>
        )}

        <div className={`p-4 rounded-xl bg-white border-2 border-black shadow-sticker-sm flex items-center justify-between ${
          sttLatencyMs === null || sttLatencyMs === undefined ? 'sm:col-span-2' : ''
        }`}>
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              RAG Pipeline Latency
            </span>
            <span className="text-2xl font-mono font-black text-emerald-900 mt-1 block">
              {latencies.total_rag.toFixed(1)} ms
            </span>
          </div>
          <span className="text-xs font-bold text-emerald-950 bg-[#FFE600] px-3 py-1 rounded-md border border-black shadow-sticker-sm">
            Sub-10ms Retrieval
          </span>
        </div>
      </div>

      {/* Pipeline Stage Breakdown */}
      <div className="p-4 rounded-xl bg-stone-100/80 border border-stone-200 font-mono text-xs">
        <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-2 font-sans">
          Pipeline Breakdown
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block text-[10px]">Embedding</span>
            <span className="font-bold text-stone-900">{latencies.embedding.toFixed(2)} ms</span>
          </div>
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block text-[10px]">Dense Vector</span>
            <span className="font-bold text-stone-900">{latencies.dense_retrieval.toFixed(2)} ms</span>
          </div>
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block text-[10px]">BM25 Sparse</span>
            <span className="font-bold text-stone-900">{latencies.bm25_retrieval.toFixed(2)} ms</span>
          </div>
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block text-[10px]">RRF Fusion</span>
            <span className="font-bold text-stone-900">{latencies.rrf.toFixed(2)} ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

