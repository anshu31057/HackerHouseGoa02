import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface AnswerCardProps {
  query: string;
  answer: string;
  grounded: boolean;
  confidence: number;
  guardrailStatus: string;
  refusalReason?: string;
  rejectionReason?: string | null;
  queryRelevanceScore?: number;
  entityMatchScore?: number;
  coverageScore?: number;
  questionTypeScore?: number;
  isLoading?: boolean;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({
  query,
  answer,
  grounded,
  confidence,
  guardrailStatus,
  refusalReason,
  rejectionReason,
  queryRelevanceScore,
  entityMatchScore,
  coverageScore,
  questionTypeScore,
  isLoading,
}) => {
  const [showTechDetails, setShowTechDetails] = useState(false);

  if (isLoading) {
    return (
      <div id="answer-card-loading" className="w-full bg-[#FDFBF7] border-2 border-black rounded-2xl p-6 shadow-sticker animate-pulse">
        <div className="h-4 bg-stone-300 rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-stone-300 rounded w-4/5 mb-3"></div>
        <div className="h-4 bg-stone-300 rounded w-1/2"></div>
      </div>
    );
  }

  if (!answer) return null;

  const isPassed = guardrailStatus === 'PASSED';

  // Human-friendly guardrail explanation
  const getFriendlyRefusal = () => {
    const code = rejectionReason || refusalReason || guardrailStatus;
    if (code.includes('INSUFFICIENT_CONTEXT') || code.includes('no_extracted_answer')) {
      return "I couldn't find enough information in the knowledge base to answer that.";
    }
    if (code.includes('entity_mismatch')) {
      return "I couldn't find verified information about that topic in the knowledge base.";
    }
    if (code.includes('missing_question_intent')) {
      return "I'm not sure what you're asking. Try asking a complete question.";
    }
    if (code.includes('underspecified_query')) {
      return "Could you make your question a little more specific?";
    }
    if (code.includes('UNSAFE') || code.includes('safety_policy_violation')) {
      return "I can't help with that request.";
    }
    if (code.includes('temporal_unavailable')) {
      return "Real-time or future temporal events are not available in the indexed knowledge base.";
    }
    return refusalReason || "No grounded answer could be confirmed for this question.";
  };

  return (
    <div id="answer-card" className="w-full bg-[#FDFBF7] text-stone-900 border-2 border-black rounded-2xl p-6 sm:p-8 shadow-sticker relative overflow-hidden">
      {/* Top Banner Accent */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b-2 border-stone-200 mb-5">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-[#FFE600] text-black font-bold text-xs border border-black shadow-sticker-sm">
            QUESTION
          </span>
          <p className="text-sm sm:text-base font-semibold text-stone-900">
            "{query}"
          </p>
        </div>

        <div>
          {isPassed ? (
            <span id="guardrail-badge" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-900 border-2 border-emerald-800 shadow-sticker-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Grounded Answer</span>
              <span className="text-[11px] font-mono text-emerald-700 bg-white/80 px-1.5 py-0.2 rounded-full ml-1">
                {Math.round(confidence * 100)}%
              </span>
            </span>
          ) : (
            <span id="guardrail-badge" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 border-2 border-amber-800 shadow-sticker-sm">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>Safely Guarded</span>
            </span>
          )}
        </div>
      </div>

      {/* Answer Body */}
      <div className="space-y-4">
        {isPassed ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF1493]" />
              <span>Direct Extractive Answer</span>
            </div>
            <p id="answer-text" className="text-lg sm:text-xl font-medium text-stone-950 leading-relaxed bg-white/70 p-4 sm:p-5 rounded-xl border border-stone-200">
              {answer}
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-xl bg-amber-50/80 border-2 border-amber-300 text-amber-950">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Knowledge Base Status</span>
            </div>
            <p className="text-base font-medium">
              {getFriendlyRefusal()}
            </p>
          </div>
        )}

        {/* Technical Details Accordion (Optional) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-black transition-colors"
          >
            <span>{showTechDetails ? 'Hide technical inspection' : 'View technical inspection'}</span>
            {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTechDetails && (
            <div className="mt-3 p-3.5 bg-stone-100 rounded-xl border border-stone-300 text-xs text-stone-700 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-stone-900">Guardrail:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-stone-200">{guardrailStatus}</span>
                {rejectionReason && (
                  <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                    Code: {rejectionReason}
                  </span>
                )}
              </div>

              {(entityMatchScore !== undefined || coverageScore !== undefined || queryRelevanceScore !== undefined) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  {entityMatchScore !== undefined && (
                    <div className="p-1.5 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block">Entity Match</span>
                      <span className="font-bold text-stone-900">{Math.round(entityMatchScore * 100)}%</span>
                    </div>
                  )}
                  {coverageScore !== undefined && (
                    <div className="p-1.5 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block">Token Coverage</span>
                      <span className="font-bold text-stone-900">{Math.round(coverageScore * 100)}%</span>
                    </div>
                  )}
                  {questionTypeScore !== undefined && (
                    <div className="p-1.5 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block">Intent Alignment</span>
                      <span className="font-bold text-stone-900">{Math.round(questionTypeScore * 100)}%</span>
                    </div>
                  )}
                  <div className="p-1.5 bg-white rounded border border-stone-200">
                    <span className="text-stone-500 block">Confidence</span>
                    <span className="font-bold text-stone-900">{Math.round(confidence * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

