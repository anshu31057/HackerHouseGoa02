import { performance } from 'perf_hooks';

export interface STTResult {
  transcript: string;
  language: string;
  stt_latency_ms: number;
  provider: 'sarvam' | 'fallback';
  confidence?: number;
}

export class STTService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SARVAM_API_KEY || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Transcribes audio buffer via Sarvam AI API or fallback.
   * STT latency is measured independently and never mixed into total_rag.
   */
  public async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string = 'audio/wav',
    languageCode: string = 'unknown'
  ): Promise<STTResult> {
    const start = performance.now();

    if (this.apiKey) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
        formData.append('file', blob, 'audio.wav');
        
        // Pass language_code only if valid Indic / English code
        if (languageCode && languageCode !== 'unknown' && languageCode !== 'auto') {
          formData.append('language_code', languageCode);
        } else {
          formData.append('language_code', 'en-IN');
        }
        formData.append('model', 'saaras:v3');

        const response = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: {
            'api-subscription-key': this.apiKey,
          },
          body: formData,
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const latency = performance.now() - start;
          return {
            transcript: data.transcript || data.text || '',
            language: data.language_code || languageCode || 'en-IN',
            stt_latency_ms: Number(latency.toFixed(2)),
            provider: 'sarvam',
            confidence: data.confidence || 0.95,
          };
        } else {
          const errText = await response.text();
          console.warn(`Sarvam STT failed with status ${response.status}: ${errText}, using fallback transcription.`);
        }
      } catch (err) {
        console.error('Sarvam STT error:', err);
      }
    }

    // When Sarvam is not configured or STT fails, return empty transcript
    const latency = performance.now() - start;
    return {
      transcript: '',
      language: languageCode === 'hi-IN' ? 'hi-IN' : 'en-IN',
      stt_latency_ms: Number(latency.toFixed(2)),
      provider: 'fallback',
      confidence: 0.0,
    };
  }
}
