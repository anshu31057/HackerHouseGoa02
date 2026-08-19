import React, { useState, useEffect } from 'react';
import { Mic, Search, Zap, Database, Award, BookOpen, HelpCircle, Sparkles, Compass, Sun, Palmtree } from 'lucide-react';
import { VoiceRecorder } from './components/VoiceRecorder';
import { AnswerCard } from './components/AnswerCard';
import { Sources, SourceItem } from './components/Sources';
import { LatencyPanel, Latencies } from './components/LatencyPanel';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { DatasetExplorer } from './components/DatasetExplorer';

const SAMPLE_QUERIES = [
  'What is phloem?',
  'What does phloem carry?',
  'How does phloem transport sugars?',
  'फ्लोएम क्या है?',
  'फ्लोएम क्या ले जाता है?',
  'What does xylem transport?',
];

export function App() {
  const [activeTab, setActiveTab] = useState<'query' | 'benchmark' | 'dataset'>('query');
  const [queryText, setQueryText] = useState('');
  const [strategy, setStrategy] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [sttLatency, setSttLatency] = useState<number | null>(null);

  const [response, setResponse] = useState<{
    query: string;
    answer: string;
    grounded: boolean;
    confidence: number;
    guardrail_status: string;
    refusal_reason?: string;
    rejection_reason?: string | null;
    query_relevance_score?: number;
    entity_match_score?: number;
    coverage_score?: number;
    question_type_score?: number;
    sources: SourceItem[];
    latencies: Latencies;
  } | null>(null);

  const [systemStatus, setSystemStatus] = useState<{
    chunks: number;
    stt_configured: boolean;
  }>({ chunks: 0, stt_configured: false });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setSystemStatus({
          chunks: data.chunks || 0,
          stt_configured: data.stt_configured || false,
        });
      })
      .catch((err) => console.log('Status fetch error:', err));
  }, []);

  const handleExecuteQuery = async (queryToRun: string, audioSttLatencyMs?: number) => {
    if (!queryToRun.trim()) return;

    setIsLoading(true);
    if (audioSttLatencyMs !== undefined) {
      setSttLatency(audioSttLatencyMs);
    } else {
      setSttLatency(null);
    }

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToRun,
          chunk_strategy: strategy === 'all' ? undefined : strategy,
        }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error('Query execution error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceTranscribed = (transcript: string, latencyMs: number) => {
    setQueryText(transcript);
    handleExecuteQuery(transcript, latencyMs);
  };

  return (
    <div className="min-h-screen bg-[#073B22] text-stone-100 font-sans antialiased flex flex-col selection:bg-[#FFE600] selection:text-black">
      {/* Top Banner / Navbar */}
      <header className="border-b-2 border-black bg-[#06321d] sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FFE600] text-black border-2 border-black shadow-sticker-sm flex items-center justify-center font-black text-lg">
              🌴
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-normal text-[#FFE600] text-sm">Hacker House</span>
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                  Goa 2026
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#FF1493] text-white border border-black shadow-sticker-sm">
                  Voice RAG
                </span>
              </div>
              <p className="text-[11px] text-stone-300 font-medium hidden sm:block">
               <span className="text-xs font-bold text-emerald-950 bg-[#FFE600] px-3 py-1 rounded-md border border-black shadow-sticker-sm">
  In-Process
</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
            <button
              id="tab-query"
              type="button"
              onClick={() => setActiveTab('query')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                activeTab === 'query'
                  ? 'bg-[#FFE600] text-black border border-black shadow-sticker-sm'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Ask</span>
            </button>

            <button
              id="tab-benchmark"
              type="button"
              onClick={() => setActiveTab('benchmark')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                activeTab === 'benchmark'
                  ? 'bg-[#FFE600] text-black border border-black shadow-sticker-sm'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Benchmark</span>
            </button>

            <button
              id="tab-dataset"
              type="button"
              onClick={() => setActiveTab('dataset')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                activeTab === 'dataset'
                  ? 'bg-[#FFE600] text-black border border-black shadow-sticker-sm'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Corpus</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col gap-8">
        {activeTab === 'query' && (
          <>
            {/* Ask Prompt Card */}
            <div className="w-full bg-[#FDFBF7] text-stone-900 border-2 border-black rounded-3xl p-6 sm:p-8 shadow-sticker relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b-2 border-stone-200 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#FF1493] text-white">
                      Instant Voice Intelligence
                    </span>
                    <span className="text-xs font-bold text-stone-500">
                      Zero Hallucinations
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-stone-950 tracking-tight">
                    Ask Anything in Natural Voice or Text
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    Direct corpus extraction with lowest response times.
                  </p>
                </div>

                <VoiceRecorder onTranscribed={handleVoiceTranscribed} disabled={isLoading} />
              </div>

              {/* Text Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecuteQuery(queryText);
                }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="query-input"
                      type="text"
                      placeholder="Type a question or press the microphone above..."
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 text-base rounded-2xl border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF1493] font-medium text-stone-900 shadow-sticker-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      id="strategy-select"
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                      className="px-3.5 py-3.5 text-xs rounded-2xl border-2 border-black bg-white font-bold text-stone-800 focus:outline-none shadow-sticker-sm"
                    >
                      <option value="all">Strategy: All (Auto Fusion)</option>
                      <option value="fixed">Strategy: Fixed Window</option>
                      <option value="sentence">Strategy: Sentence Aware</option>
                      <option value="semantic">Strategy: Semantic Coherence</option>
                      <option value="metadata">Strategy: Metadata / Structured</option>
                    </select>

                    <button
                      id="submit-query-btn"
                      type="submit"
                      disabled={isLoading || !queryText.trim()}
                      className="px-6 py-3.5 bg-[#073B22] hover:bg-[#0a4829] text-[#FFE600] text-sm font-black rounded-2xl border-2 border-black shadow-sticker transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>

                {/* Sample Queries */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
                    Try Asking:
                  </span>
                  <div className="flex items-center flex-wrap gap-2">
                    {SAMPLE_QUERIES.map((sq, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setQueryText(sq);
                          handleExecuteQuery(sq);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border-2 border-black/80 shadow-sticker-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]"
                      >
                        {sq}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            {/* Answer Display */}
            {response && (
              <AnswerCard
                query={response.query}
                answer={response.answer}
                grounded={response.grounded}
                confidence={response.confidence}
                guardrailStatus={response.guardrail_status}
                refusalReason={response.refusal_reason}
                rejectionReason={response.rejection_reason}
                queryRelevanceScore={response.query_relevance_score}
                entityMatchScore={response.entity_match_score}
                coverageScore={response.coverage_score}
                questionTypeScore={response.question_type_score}
                isLoading={isLoading}
              />
            )}

            {/* Latency Telemetry */}
            {response && (
              <LatencyPanel latencies={response.latencies} sttLatencyMs={sttLatency} />
            )}

            {/* Retrieved Sources */}
            {response && response.sources && response.sources.length > 0 && (
              <Sources sources={response.sources} />
            )}
          </>
        )}

        {activeTab === 'benchmark' && <BenchmarkPanel />}

        {activeTab === 'dataset' && <DatasetExplorer />}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-[#06321d] py-5 mt-auto text-xs text-stone-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-black text-[#FFE600]">🌴 Hacker House Goa 2026</span>
            <span className="text-stone-500">•</span>
            <span>Sub-10ms Voice Extractive RAG</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="bg-black/40 px-2.5 py-1 rounded-md border border-white/10 text-stone-200">
              Corpus: <strong className="text-[#FFE600]">{systemStatus.chunks.toLocaleString()}</strong> Chunks
            </span>
            <span className="bg-black/40 px-2.5 py-1 rounded-md border border-white/10 text-stone-200">
              STT: <strong className="text-emerald-400">{systemStatus.stt_configured ? 'Sarvam AI' : 'Active'}</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
