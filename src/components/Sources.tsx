import React from 'react';
import { BookOpen, Layers, ExternalLink } from 'lucide-react';

export interface SourceItem {
  chunk_id: string;
  doc_id: string;
  title?: string;
  strategy: string;
  language: string;
  text: string;
  parent_id?: string;
  parent_text?: string;
  finalScore: number;
  denseRank: number | null;
  bm25Rank: number | null;
}

interface SourcesProps {
  sources: SourceItem[];
}

export const Sources: React.FC<SourcesProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div id="sources-container" className="w-full bg-[#FDFBF7] text-stone-900 border-2 border-black rounded-2xl p-6 sm:p-8 shadow-sticker">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b-2 border-stone-200">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#FF1493]" />
          <span>Retrieved Knowledge Sources ({sources.length})</span>
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#FFE600] text-black border border-black shadow-sticker-sm">
          Verified Corpus Evidence
        </span>
      </div>

      <div className="space-y-4">
        {sources.map((src, idx) => (
          <div
            key={src.chunk_id || idx}
            id={`source-item-${idx}`}
            className="p-5 rounded-xl bg-white border-2 border-stone-200 hover:border-black transition-all shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center flex-wrap gap-2">
                <span className="w-6 h-6 rounded-full bg-[#FFE600] text-black text-xs font-black flex items-center justify-center border border-black">
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-stone-950 truncate max-w-sm">
                  {src.title || src.doc_id}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-300">
                  {src.strategy}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 uppercase">
                  {src.language}
                </span>
              </div>
            </div>

            <p className="text-sm text-stone-800 leading-relaxed font-sans mt-1 bg-stone-50/70 p-3 rounded-lg border border-stone-200">
              {src.text}
            </p>

            {src.parent_text && src.parent_text !== src.text && (
              <details className="mt-2.5 text-xs text-stone-500">
                <summary className="cursor-pointer hover:text-stone-900 font-semibold select-none">
                  Show complete passage context ({src.doc_id})
                </summary>
                <p className="mt-1.5 p-3 rounded-lg bg-stone-100 text-stone-800 leading-relaxed italic border border-stone-200">
                  {src.parent_text}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
