import React, { useState, useEffect } from 'react';
import { Database, Search, Filter, Layers, BookOpen } from 'lucide-react';

interface ChunkItem {
  chunk_id: string;
  doc_id: string;
  strategy: string;
  language: string;
  title?: string;
  text: string;
  word_count: number;
}

export const DatasetExplorer: React.FC = () => {
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [strategy, setStrategy] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [strategyCounts, setStrategyCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchChunks = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (strategy && strategy !== 'all') params.append('strategy', strategy);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/chunks?${params.toString()}`);
      const data = await res.json();

      setChunks(data.chunks || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.strategyCounts) {
        setStrategyCounts(data.strategyCounts);
      }
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChunks();
  }, [page, strategy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchChunks();
  };

  return (
    <div id="dataset-explorer" className="w-full bg-[#FDFBF7] text-stone-900 border-2 border-black rounded-2xl p-6 sm:p-8 shadow-sticker">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-stone-200 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#FF1493]" />
            Knowledge Base Corpus
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Browse and search 10,400+ indexed passages with multimodal chunking.
          </p>
        </div>

        {/* Strategy Breakdown Chips */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="px-3 py-1 rounded-md bg-[#FFE600] text-black font-bold border border-black shadow-sticker-sm">
            Total Chunks: {total.toLocaleString()}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white text-stone-800 font-semibold border border-stone-300">
            Fixed: {strategyCounts.fixed?.toLocaleString() || 0}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white text-stone-800 font-semibold border border-stone-300">
            Sentence: {strategyCounts.sentence?.toLocaleString() || 0}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white text-stone-800 font-semibold border border-stone-300">
            Semantic: {strategyCounts.semantic?.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-5">
        <form onSubmit={handleSearch} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search knowledge passages by keyword or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF1493] font-medium"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#073B22] hover:bg-[#0a4829] text-[#FFE600] text-xs font-black rounded-xl border-2 border-black shadow-sticker-sm transition-all"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-stone-500" />
          <select
            value={strategy}
            onChange={(e) => {
              setStrategy(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2.5 text-xs rounded-xl border-2 border-black bg-white font-bold text-stone-800 focus:outline-none"
          >
            <option value="">All Chunking Strategies</option>
            <option value="fixed">Fixed Window</option>
            <option value="sentence">Sentence Aware</option>
            <option value="semantic">Semantic Coherence</option>
            <option value="metadata">Metadata / Structured</option>
          </select>
        </div>
      </div>

      {/* Chunks Table */}
      <div className="border-2 border-black rounded-xl overflow-hidden shadow-sticker-sm bg-white">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-stone-100 text-stone-900 sticky top-0 border-b-2 border-stone-200">
              <tr>
                <th className="p-3 font-bold">Chunk ID</th>
                <th className="p-3 font-bold">Strategy</th>
                <th className="p-3 font-bold">Topic / Document</th>
                <th className="p-3 font-bold">Content Snippet</th>
                <th className="p-3 font-bold text-right">Words</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500 font-medium">
                    Loading passages from index...
                  </td>
                </tr>
              ) : chunks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500 font-medium">
                    No passages found matching search term.
                  </td>
                </tr>
              ) : (
                chunks.map((ch) => (
                  <tr key={ch.chunk_id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-stone-500 whitespace-nowrap">{ch.chunk_id}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[11px] font-bold border border-stone-300">
                        {ch.strategy}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-stone-900 truncate max-w-[180px]">
                      {ch.title || ch.doc_id}
                    </td>
                    <td className="p-3 text-stone-700 leading-relaxed max-w-md">
                      {ch.text}
                    </td>
                    <td className="p-3 font-mono text-stone-500 text-right whitespace-nowrap">{ch.word_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between mt-4 text-xs font-semibold text-stone-600">
        <span>
          Page {page} of {totalPages} ({total.toLocaleString()} passages)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-stone-100 font-bold text-stone-800 shadow-sticker-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-stone-100 font-bold text-stone-800 shadow-sticker-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
