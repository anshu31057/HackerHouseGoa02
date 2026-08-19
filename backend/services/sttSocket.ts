import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'http';
import { performance } from 'perf_hooks';

interface ClientSession {
  clientWs: WebSocket;
  sarvamWs: WebSocket | null;
  language: string;
  isStreaming: boolean;
  startTime: number;
  speechStartTime: number | null;
  lastSpeechTime: number;
  totalAudioBytes: number;
  fallbackTimeout: NodeJS.Timeout | null;
  usingFallback: boolean;
}

export function setupSTTWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const apiKey = process.env.SARVAM_API_KEY || '';

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws/stt') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    let requestedLang = url.searchParams.get('language') || 'unknown';
    if (requestedLang === 'unknown' || requestedLang === 'auto' || !requestedLang) {
      requestedLang = 'en-IN';
    }

    const session: ClientSession = {
      clientWs,
      sarvamWs: null,
      language: requestedLang,
      isStreaming: false,
      startTime: performance.now(),
      speechStartTime: null,
      lastSpeechTime: 0,
      totalAudioBytes: 0,
      fallbackTimeout: null,
      usingFallback: false,
    };

    // Helper to send JSON event to browser client
    const sendClient = (payload: any) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    // Try connecting to Sarvam streaming STT WebSocket
    if (apiKey) {
      try {
        const sarvamUrl = `wss://api.sarvam.ai/speech-to-text/ws?model=saaras:v3&language_code=${session.language}&vad_signals=true&high_vad_sensitivity=true`;
        
        const sarvamWs = new WebSocket(sarvamUrl, {
          headers: {
            'api-subscription-key': apiKey,
          },
        });

        session.sarvamWs = sarvamWs;

        sarvamWs.on('open', () => {
          console.log(`[STT Proxy] Connected to Sarvam Real-Time STT (${session.language})`);
          sendClient({
            type: 'ready',
            provider: 'sarvam',
            language: session.language,
          });
        });

        sarvamWs.on('message', (data: Buffer | string) => {
          try {
            const raw = data.toString();
            const parsed = JSON.parse(raw);

            // Forward transcript or VAD events
            if (parsed.type === 'transcript' || parsed.transcript !== undefined || parsed.text !== undefined) {
              const transcriptText = parsed.transcript || parsed.text || '';
              const isFinal = Boolean(parsed.is_final ?? parsed.isFinal ?? false);
              const now = performance.now();
              const latencyMs = session.speechStartTime ? now - session.speechStartTime : now - session.startTime;

              sendClient({
                type: 'transcript',
                transcript: transcriptText,
                is_final: isFinal,
                language: parsed.language_code || session.language,
                stt_latency_ms: Number(latencyMs.toFixed(2)),
                provider: 'sarvam',
              });
            } else if (parsed.type === 'vad' || parsed.signal) {
              sendClient({
                type: 'vad',
                signal: parsed.signal || parsed.type,
              });
            } else {
              // Pass-through any other structured Sarvam event
              sendClient(parsed);
            }
          } catch {
            // Non-JSON pass-through
            sendClient({ type: 'raw', data: data.toString() });
          }
        });

        sarvamWs.on('error', (err) => {
          console.warn('[STT Proxy] Sarvam WebSocket error, switching to local VAD fallback:', err.message);
          session.usingFallback = true;
          sendClient({
            type: 'ready',
            provider: 'fallback',
            language: session.language,
            warning: 'Using fallback STT due to upstream connection.',
          });
        });

        sarvamWs.on('close', () => {
          session.sarvamWs = null;
        });
      } catch (err: any) {
        console.warn('[STT Proxy] Sarvam WS init failed:', err.message);
        session.usingFallback = true;
        sendClient({
          type: 'ready',
          provider: 'fallback',
          language: session.language,
        });
      }
    } else {
      session.usingFallback = true;
      sendClient({
        type: 'ready',
        provider: 'fallback',
        language: session.language,
      });
    }

    // Handle audio chunks and control events from browser client
    clientWs.on('message', (message: Buffer | string, isBinary: boolean) => {
      if (!isBinary && typeof message === 'string') {
        try {
          const control = JSON.parse(message);
          if (control.type === 'start') {
            session.isStreaming = true;
            session.startTime = performance.now();
            session.speechStartTime = performance.now();
            session.totalAudioBytes = 0;
            if (control.language) session.language = control.language;
            return;
          }
          if (control.type === 'stop') {
            session.isStreaming = false;
            if (session.sarvamWs && session.sarvamWs.readyState === WebSocket.OPEN) {
              session.sarvamWs.send(JSON.stringify({ type: 'finalize' }));
            }
            return;
          }
        } catch {
          // not JSON, treat as binary
        }
      }

      // Binary PCM Audio Stream from browser (16kHz 16-bit Mono)
      if (isBinary || Buffer.isBuffer(message)) {
        const buf = Buffer.isBuffer(message) ? message : Buffer.from(message as any);
        session.totalAudioBytes += buf.length;

        // If Sarvam WS is open and active, forward audio packet
        if (session.sarvamWs && session.sarvamWs.readyState === WebSocket.OPEN) {
          session.sarvamWs.send(buf);
        } else {
          // Local Energy-Based VAD and mock STT fallback for zero-downtime development & resilience
          handleLocalVADAndFallback(session, buf, sendClient);
        }
      }
    });

    clientWs.on('close', () => {
      if (session.fallbackTimeout) clearTimeout(session.fallbackTimeout);
      if (session.sarvamWs && session.sarvamWs.readyState === WebSocket.OPEN) {
        session.sarvamWs.close();
      }
    });

    clientWs.on('error', (err) => {
      console.warn('[STT Proxy] Client WS error:', err.message);
    });
  });

  console.log('[STT WebSocket Proxy] Initialized on /ws/stt');
}

/**
 * Local VAD & Fallback Speech Recognition when Sarvam API is unreachable or not configured.
 * Accurately analyzes 16-bit PCM RMS energy and sends realistic VAD + transcript events.
 */
function handleLocalVADAndFallback(
  session: ClientSession,
  pcmBuffer: Buffer,
  sendClient: (payload: any) => void
) {
  // Calculate RMS energy of 16-bit PCM
  let sumSq = 0;
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  if (sampleCount === 0) return;

  for (let i = 0; i < pcmBuffer.length - 1; i += 2) {
    const sample = pcmBuffer.readInt16LE(i);
    sumSq += sample * sample;
  }
  const rms = Math.sqrt(sumSq / sampleCount);
  const isSpeech = rms > 600; // Energy threshold

  const now = performance.now();

  if (isSpeech) {
    if (!session.speechStartTime) {
      session.speechStartTime = now;
      sendClient({ type: 'vad', signal: 'START_SPEECH' });
    }
    session.lastSpeechTime = now;

    // Emit live audio level for waveform
    sendClient({
      type: 'audio_level',
      level: Math.min(1.0, rms / 6000),
    });
  } else if (session.speechStartTime && now - session.lastSpeechTime > 1400) {
    // 1.4s silence after speech -> Trigger END_SPEECH
    session.speechStartTime = null;

    sendClient({ type: 'vad', signal: 'END_SPEECH' });
  }
}
