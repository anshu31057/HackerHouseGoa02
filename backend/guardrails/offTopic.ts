import { GuardrailResult } from './types.js';

export function checkOffTopicGuardrail(query: string): GuardrailResult {
  const q = query.trim();
  const cleaned = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      passed: false,
      status: 'OFF_TOPIC',
      reason: 'No recognizable language tokens found in query.',
    };
  }

  // Check for repeated random keyboard mash (e.g. "asdfasdfasdf" or single character repetitions)
  const isGibberish = words.every((w) => {
    if (w.length > 25) return true;
    if (/(.)\1{4,}/.test(w)) return true; // 5 identical consecutive characters
    return false;
  });

  if (isGibberish) {
    return {
      passed: false,
      status: 'OFF_TOPIC',
      reason: 'Input appears to be random character repetition or ungroundable string.',
    };
  }

  // System prompt injection checks (knowing when NOT to answer meta-hacks)
  if (
    /^(?:ignore all previous instructions|system prompt|jailbreak|DAN mode|who made you|are you gemini)/i.test(q)
  ) {
    return {
      passed: false,
      status: 'OFF_TOPIC',
      reason: 'Meta-prompting or instructional override detected. Only knowledge base queries supported.',
    };
  }

  return {
    passed: true,
    status: 'PASSED',
  };
}
