import { GuardrailResult } from './types.js';

const UNSAFE_PATTERNS = [
  /\b(?:how to (?:make|build|create|write|develop|program)\s+(?:a\s+)?(?:malicious\s+)?(?:bomb|explosive|weapon|poison|malware|virus|computer virus|trojan|ransomware|exploit))\b/i,
  /\b(?:kill|murder|harm|assassinate)\s+(?:someone|people|myself|yourself)\b/i,
  /\b(?:credit card generator|free ssn|hack passwords|sql injection payload)\b/i,
  /\b(?:suicide instructions|self-harm method)\b/i,
  /\b(?:child exploitation|csam)\b/i,
];

export function checkSafetyGuardrail(query: string): GuardrailResult {
  const q = query.trim();
  if (!q) {
    return {
      passed: false,
      status: 'UNSAFE',
      reason: 'Empty query provided.',
    };
  }

  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(q)) {
      return {
        passed: false,
        status: 'UNSAFE',
        reason: 'Query was flagged by safety guardrails for potentially harmful or prohibited content.',
      };
    }
  }

  return {
    passed: true,
    status: 'PASSED',
  };
}
