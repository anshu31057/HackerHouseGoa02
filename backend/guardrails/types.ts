export type GuardrailStatus =
  | 'PASSED'
  | 'UNSAFE'
  | 'OFF_TOPIC'
  | 'NO_CONTEXT'
  | 'LOW_CONFIDENCE'
  | 'GROUNDING_FAILED'
  | 'INSUFFICIENT_CONTEXT';

export interface GuardrailResult {
  passed: boolean;
  status: GuardrailStatus;
  reason?: string;
  confidence?: number;
}

