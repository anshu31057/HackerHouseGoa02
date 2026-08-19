import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';

import {
  Mic,
  MicOff,
  Loader2,
  Globe,
} from 'lucide-react';

interface VoiceRecorderProps {
  onTranscribed: (
    transcript: string,
    sttLatencyMs: number,
    language: string
  ) => void;

  disabled?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
  { code: 'kok-IN', name: 'कोंकणी (Konkani)' },
  { code: 'mr-IN', name: 'मराठी (Marathi)' },
  { code: 'bn-IN', name: 'বাংলা (Bengali)' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)' },
  { code: 'te-IN', name: 'తెలుగు (Telugu)' },
  { code: 'gu-IN', name: 'ગુજરાતી (Gujarati)' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml-IN', name: 'മലയാളം (Malayalam)' },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'od-IN', name: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'as-IN', name: 'অসমীয়া (Assamese)' },
  { code: 'ne-IN', name: 'नेपाली (Nepali)' },
  { code: 'ur-IN', name: 'اردو (Urdu)' },
  { code: 'sa-IN', name: 'संस्कृतम् (Sanskrit)' },
];

type RecordingState =
  | 'idle'
  | 'recording'
  | 'transcribing';

export const VoiceRecorder: React.FC<
  VoiceRecorderProps
> = ({
  onTranscribed,
  disabled = false,
}) => {
  const [recordingState, setRecordingState] =
    useState<RecordingState>('idle');

  const [selectedLanguage, setSelectedLanguage] =
    useState('en-IN');

  const [liveTranscript, setLiveTranscript] =
    useState('');

  const [currentTranscript, setCurrentTranscript] =
    useState('');

  const [voiceError, setVoiceError] =
    useState<string | null>(null);

  const [audioLevel, setAudioLevel] =
    useState(0);

  const [vadState, setVadState] =
    useState<
      'idle' | 'speaking' | 'silence'
    >('idle');

  /*
   * -------------------------------------------------------
   * REFS
   * -------------------------------------------------------
   */

  const sessionIdRef = useRef('');

  const socketRef =
    useRef<WebSocket | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const analyserRef =
    useRef<AnalyserNode | null>(null);

  const processorRef =
    useRef<ScriptProcessorNode | null>(null);

  const animationRef =
    useRef<number | null>(null);

  const audioChunksRef =
    useRef<Blob[]>([]);

  const lastTranscriptRef =
    useRef('');

  const recordingStateRef =
    useRef<RecordingState>('idle');

  const startTimeRef =
    useRef(0);

  const finalizingRef =
    useRef(false);

  /*
   * -------------------------------------------------------
   * STATE REF
   * -------------------------------------------------------
   */

  useEffect(() => {
    recordingStateRef.current =
      recordingState;
  }, [recordingState]);

  /*
   * -------------------------------------------------------
   * AUDIO CLEANUP
   * -------------------------------------------------------
   */

  const cleanupAudio =
    useCallback(() => {
      if (
        animationRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationRef.current
        );

        animationRef.current =
          null;
      }

      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
        } catch {}

        processorRef.current =
          null;
      }

      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {}

        analyserRef.current =
          null;
      }

      if (audioContextRef.current) {
        try {
          if (
            audioContextRef.current
              .state !== 'closed'
          ) {
            audioContextRef.current.close();
          }
        } catch {}

        audioContextRef.current =
          null;
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch {}
          });

        streamRef.current =
          null;
      }

      setAudioLevel(0);
      setVadState('idle');
    }, []);

  /*
   * -------------------------------------------------------
   * CLOSE SOCKET
   * -------------------------------------------------------
   */

  const closeSocket =
    useCallback(() => {
      const socket =
        socketRef.current;

      if (!socket) {
        return;
      }

      try {
        if (
          socket.readyState ===
          WebSocket.OPEN
        ) {
          socket.send(
            JSON.stringify({
              type: 'stop',
            })
          );
        }
      } catch {}

      try {
        socket.close();
      } catch {}

      socketRef.current =
        null;
    }, []);

  /*
   * -------------------------------------------------------
   * COMPONENT CLEANUP
   * -------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      closeSocket();
      cleanupAudio();

      const recorder =
        mediaRecorderRef.current;

      if (
        recorder &&
        recorder.state !==
          'inactive'
      ) {
        try {
          recorder.stop();
        } catch {}
      }

      mediaRecorderRef.current =
        null;
    };
  }, [
    closeSocket,
    cleanupAudio,
  ]);

  /*
   * -------------------------------------------------------
   * MEDIA RECORDER STOP
   * -------------------------------------------------------
   */

  const stopMediaRecorder =
    useCallback(
      async (): Promise<Blob | null> => {
        const recorder =
          mediaRecorderRef.current;

        if (!recorder) {
          if (
            audioChunksRef.current
              .length > 0
          ) {
            return new Blob(
              audioChunksRef.current,
              {
                type: 'audio/webm',
              }
            );
          }

          return null;
        }

        if (
          recorder.state ===
          'inactive'
        ) {
          mediaRecorderRef.current =
            null;

          if (
            audioChunksRef.current
              .length > 0
          ) {
            return new Blob(
              audioChunksRef.current,
              {
                type:
                  recorder.mimeType ||
                  'audio/webm',
              }
            );
          }

          return null;
        }

        return new Promise(
          (resolve) => {
            const finish =
              () => {
                mediaRecorderRef.current =
                  null;

                if (
                  audioChunksRef.current
                    .length > 0
                ) {
                  resolve(
                    new Blob(
                      audioChunksRef.current,
                      {
                        type:
                          recorder.mimeType ||
                          'audio/webm',
                      }
                    )
                  );
                } else {
                  resolve(null);
                }
              };

            recorder.onstop =
              finish;

            try {
              recorder.stop();
            } catch {
              finish();
            }

            window.setTimeout(
              finish,
              1500
            );
          }
        );
      },
      []
    );

  /*
   * -------------------------------------------------------
   * BATCH TRANSCRIPTION FALLBACK
   * -------------------------------------------------------
   */

  const transcribeBlob =
    useCallback(
      async (
        blob: Blob,
        sessionId: string
      ): Promise<boolean> => {
        if (
          !blob ||
          blob.size === 0
        ) {
          return false;
        }

        try {
          const formData =
            new FormData();

          /*
           * IMPORTANT:
           * Backend uses upload.single('audio')
           */
          formData.append(
            'audio',
            blob,
            'recording.webm'
          );

          formData.append(
            'language',
            selectedLanguage
          );

          console.info(
            '[Voice] Sending audio to /api/transcribe...',
            blob.size,
            'bytes'
          );

          const response =
            await fetch(
              '/api/transcribe',
              {
                method: 'POST',
                body: formData,
              }
            );

          if (
            sessionIdRef.current !==
            sessionId
          ) {
            return false;
          }

          if (!response.ok) {
            const text =
              await response.text();

            console.warn(
              '[Voice] Batch STT failed:',
              response.status,
              text
            );

            return false;
          }

          const data =
            await response.json();

          const transcript =
            String(
              data?.transcript ||
              data?.text ||
              ''
            ).trim();

          if (!transcript) {
            return false;
          }

          const latency =
            Number(
              data?.stt_latency_ms ??
              data?.latencyMs ??
              performance.now() -
                startTimeRef.current
            );

          setCurrentTranscript(
            transcript
          );

          setLiveTranscript('');

          setVoiceError(null);

          setRecordingState(
            'idle'
          );

          recordingStateRef.current =
            'idle';

          onTranscribed(
            transcript,
            Math.round(latency),
            data?.language ||
              selectedLanguage
          );

          return true;
        } catch (error) {
          console.error(
            '[Voice] Batch STT error:',
            error
          );

          return false;
        }
      },
      [
        onTranscribed,
        selectedLanguage,
      ]
    );

  /*
   * -------------------------------------------------------
   * FINALIZE
   * -------------------------------------------------------
   */

  const finalizeRecording =
    useCallback(
      (
        sessionId: string,
        transcript: string,
        latency?: number,
        language?: string
      ) => {
        if (
          sessionIdRef.current !==
          sessionId
        ) {
          return;
        }

        if (
          finalizingRef.current
        ) {
          return;
        }

        const clean =
          transcript.trim();

        if (!clean) {
          return;
        }

        finalizingRef.current =
          true;

        setCurrentTranscript(
          clean
        );

        setLiveTranscript('');

        setVoiceError(null);

        setRecordingState(
          'idle'
        );

        recordingStateRef.current =
          'idle';

        closeSocket();
        cleanupAudio();

        const finalLatency =
          Number(
            latency ??
              performance.now() -
                startTimeRef.current
          );

        onTranscribed(
          clean,
          Math.round(
            finalLatency
          ),
          language ||
            selectedLanguage
        );

        window.setTimeout(
          () => {
            finalizingRef.current =
              false;
          },
          100
        );
      },
      [
        cleanupAudio,
        closeSocket,
        onTranscribed,
        selectedLanguage,
      ]
    );

  /*
   * -------------------------------------------------------
   * START RECORDING
   * -------------------------------------------------------
   */

  const startRecording =
    async () => {
      if (
        disabled ||
        recordingState !==
          'idle'
      ) {
        return;
      }

      const sessionId =
        crypto.randomUUID();

      sessionIdRef.current =
        sessionId;

      finalizingRef.current =
        false;

      audioChunksRef.current =
        [];

      lastTranscriptRef.current =
        '';

      setLiveTranscript('');
      setCurrentTranscript('');
      setVoiceError(null);
      setAudioLevel(0);
      setVadState('idle');

      setRecordingState(
        'recording'
      );

      recordingStateRef.current =
        'recording';

      startTimeRef.current =
        performance.now();

      try {
        /*
         * ---------------------------------------------------
         * MICROPHONE
         * ---------------------------------------------------
         */

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          throw new Error(
            'Browser microphone API unavailable.'
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                channelCount: 1,
                echoCancellation:
                  true,
                noiseSuppression:
                  true,
                autoGainControl:
                  true,
              },
            }
          );

        if (
          sessionIdRef.current !==
          sessionId
        ) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        streamRef.current =
          stream;

        /*
         * ---------------------------------------------------
         * MEDIA RECORDER
         * ---------------------------------------------------
         */

        try {
          let mimeType = '';

          if (
            MediaRecorder.isTypeSupported(
              'audio/webm;codecs=opus'
            )
          ) {
            mimeType =
              'audio/webm;codecs=opus';
          } else if (
            MediaRecorder.isTypeSupported(
              'audio/webm'
            )
          ) {
            mimeType =
              'audio/webm';
          } else if (
            MediaRecorder.isTypeSupported(
              'audio/mp4'
            )
          ) {
            mimeType =
              'audio/mp4';
          }

          const recorder =
            mimeType
              ? new MediaRecorder(
                  stream,
                  {
                    mimeType,
                  }
                )
              : new MediaRecorder(
                  stream
                );

          recorder.ondataavailable =
            (event) => {
              if (
                sessionIdRef.current !==
                sessionId
              ) {
                return;
              }

              if (
                event.data &&
                event.data.size > 0
              ) {
                audioChunksRef.current.push(
                  event.data
                );
              }
            };

          recorder.onerror =
            (event) => {
              console.warn(
                '[Voice] MediaRecorder error:',
                event
              );
            };

          recorder.start(250);

          mediaRecorderRef.current =
            recorder;
        } catch (error) {
          console.warn(
            '[Voice] MediaRecorder unavailable:',
            error
          );
        }

        /*
         * ---------------------------------------------------
         * BACKEND WEBSOCKET
         * ---------------------------------------------------
         *
         * NO Browser SpeechRecognition here.
         *
         * This removes Chrome/Brave:
         *
         * SpeechRecognition error: network
         */

        const protocol =
          window.location.protocol ===
          'https:'
            ? 'wss:'
            : 'ws:';

        const wsUrl =
          `${protocol}//${window.location.host}` +
          `/ws/stt?language=${encodeURIComponent(
            selectedLanguage
          )}`;

        console.info(
          '[Voice] Connecting STT WebSocket:',
          wsUrl
        );

        const ws =
          new WebSocket(wsUrl);

        socketRef.current =
          ws;

        ws.binaryType =
          'arraybuffer';

        ws.onopen = () => {
          if (
            sessionIdRef.current !==
            sessionId
          ) {
            return;
          }

          console.info(
            '[Voice] STT WebSocket connected.'
          );

          try {
            ws.send(
              JSON.stringify({
                type: 'start',
                language:
                  selectedLanguage,
              })
            );
          } catch (error) {
            console.warn(
              '[Voice] STT start failed:',
              error
            );
          }
        };

        ws.onmessage =
          (event) => {
            if (
              sessionIdRef.current !==
              sessionId
            ) {
              return;
            }

            try {
              const message =
                typeof event.data ===
                'string'
                  ? JSON.parse(
                      event.data
                    )
                  : null;

              if (!message) {
                return;
              }

              /*
               * TRANSCRIPT
               */

              if (
                message.type ===
                'transcript'
              ) {
                const text =
                  String(
                    message.transcript ||
                    message.text ||
                    ''
                  ).trim();

                if (!text) {
                  return;
                }

                setLiveTranscript(
                  text
                );

                lastTranscriptRef.current =
                  text;

                setVoiceError(null);

                /*
                 * Final transcript.
                 */
                if (
                  message.is_final ===
                  true
                ) {
                  finalizeRecording(
                    sessionId,
                    text,
                    message.stt_latency_ms,
                    message.language
                  );
                }

                return;
              }

              /*
               * VAD
               */

              if (
                message.type ===
                'vad'
              ) {
                if (
                  message.signal ===
                  'START_SPEECH'
                ) {
                  setVadState(
                    'speaking'
                  );
                }

                if (
                  message.signal ===
                  'END_SPEECH'
                ) {
                  setVadState(
                    'silence'
                  );
                }

                return;
              }

              /*
               * AUDIO LEVEL
               */

              if (
                message.type ===
                'audio_level'
              ) {
                const level =
                  Number(
                    message.level ||
                    0
                  );

                setAudioLevel(
                  Math.max(
                    0,
                    Math.min(
                      1,
                      level
                    )
                  )
                );

                return;
              }

              /*
               * SERVER ERROR
               */

              if (
                message.type ===
                'error'
              ) {
                console.warn(
                  '[Voice] STT server error:',
                  message.error
                );

                /*
                 * Don't kill recording.
                 * MediaRecorder remains active.
                 */
                return;
              }
            } catch (error) {
              console.warn(
                '[Voice] Invalid STT message:',
                error
              );
            }
          };

        ws.onerror = () => {
          /*
           * Do NOT show scary error.
           *
           * Batch fallback continues.
           */
          console.warn(
            '[Voice] Live STT WebSocket unavailable. Using audio fallback.'
          );
        };

        ws.onclose = () => {
          console.warn(
            '[Voice] STT WebSocket closed.'
          );
        };

        /*
         * ---------------------------------------------------
         * WEB AUDIO
         * ---------------------------------------------------
         */

        const AudioContextClass =
          window.AudioContext ||
          (
            window as any
          ).webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error(
            'Web Audio API unavailable.'
          );
        }

        const audioContext =
          new AudioContextClass();

        audioContextRef.current =
          audioContext;

        if (
          audioContext.state ===
          'suspended'
        ) {
          await audioContext.resume();
        }

        const source =
          audioContext.createMediaStreamSource(
            stream
          );

        const analyser =
          audioContext.createAnalyser();

        analyser.fftSize = 256;

        analyserRef.current =
          analyser;

        const processor =
          audioContext.createScriptProcessor(
            2048,
            1,
            1
          );

        processorRef.current =
          processor;

        /*
         * PCM → WebSocket
         */

        processor.onaudioprocess =
          (event) => {
            if (
              sessionIdRef.current !==
              sessionId
            ) {
              return;
            }

            if (
              ws.readyState !==
              WebSocket.OPEN
            ) {
              return;
            }

            const input =
              event.inputBuffer.getChannelData(
                0
              );

            const pcm =
              new Int16Array(
                input.length
              );

            for (
              let i = 0;
              i < input.length;
              i++
            ) {
              const sample =
                Math.max(
                  -1,
                  Math.min(
                    1,
                    input[i]
                  )
                );

              pcm[i] =
                sample < 0
                  ? sample *
                    0x8000
                  : sample *
                    0x7fff;
            }

            try {
              ws.send(
                pcm.buffer
              );
            } catch {}
          };

        source.connect(
          analyser
        );

        analyser.connect(
          processor
        );

        processor.connect(
          audioContext.destination
        );

        /*
         * LOCAL AUDIO METER
         */

        const updateMeter =
          () => {
            if (
              sessionIdRef.current !==
              sessionId
            ) {
              return;
            }

            const currentAnalyser =
              analyserRef.current;

            if (currentAnalyser) {
              const data =
                new Uint8Array(
                  currentAnalyser.frequencyBinCount
                );

              currentAnalyser.getByteFrequencyData(
                data
              );

              let sum = 0;

              for (
                let i = 0;
                i < data.length;
                i++
              ) {
                sum += data[i];
              }

              const avg =
                data.length
                  ? sum /
                    data.length
                  : 0;

              setAudioLevel(
                Math.min(
                  1,
                  avg / 80
                )
              );
            }

            animationRef.current =
              requestAnimationFrame(
                updateMeter
              );
          };

        updateMeter();

      } catch (error: any) {
        console.error(
          '[Voice] Microphone startup failed:',
          error
        );

        closeSocket();
        cleanupAudio();

        const recorder =
          mediaRecorderRef.current;

        if (
          recorder &&
          recorder.state !==
            'inactive'
        ) {
          try {
            recorder.stop();
          } catch {}
        }

        mediaRecorderRef.current =
          null;

        setRecordingState(
          'idle'
        );

        recordingStateRef.current =
          'idle';

        setVoiceError(
          error?.message ||
          'Microphone could not be started.'
        );
      }
    };

  /*
   * -------------------------------------------------------
   * MANUAL STOP
   * -------------------------------------------------------
   */

  const handleManualStop =
    async () => {
      if (
        recordingState !==
        'recording'
      ) {
        return;
      }

      const sessionId =
        sessionIdRef.current;

      setRecordingState(
        'transcribing'
      );

      recordingStateRef.current =
        'transcribing';

      /*
       * 1. Existing realtime transcript
       */

      const realtimeText =
        lastTranscriptRef.current.trim();

      if (
        realtimeText.length > 1
      ) {
        finalizeRecording(
          sessionId,
          realtimeText
        );

        return;
      }

      /*
       * 2. Stop recorder FIRST.
       */

      const blob =
        await stopMediaRecorder();

      /*
       * 3. Close live socket.
       */

      closeSocket();
      cleanupAudio();

      /*
       * 4. Give websocket a tiny chance.
       */

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150
          )
      );

      const lateText =
        lastTranscriptRef.current.trim();

      if (
        lateText.length > 1
      ) {
        finalizeRecording(
          sessionId,
          lateText
        );

        return;
      }

      /*
       * 5. Batch STT.
       */

      if (blob) {
        const success =
          await transcribeBlob(
            blob,
            sessionId
          );

        if (success) {
          return;
        }
      }

      /*
       * 6. Nothing worked.
       */

      if (
        sessionIdRef.current ===
        sessionId
      ) {
        setRecordingState(
          'idle'
        );

        recordingStateRef.current =
          'idle';

        setVoiceError(
          'No speech detected. Please check microphone permission and try again.'
        );
      }
    };

  /*
   * -------------------------------------------------------
   * UI
   * -------------------------------------------------------
   */

  return (
    <div className="w-full flex flex-col items-center gap-3">

      <div className="flex flex-wrap items-center justify-center gap-3">

        <div className="relative flex items-center">

          <Globe className="w-4 h-4 absolute left-3 text-stone-600 pointer-events-none" />

          <select
            id="stt-language-select"
            value={selectedLanguage}
            onChange={(event) =>
              setSelectedLanguage(
                event.target.value
              )
            }
            disabled={
              recordingState !==
                'idle' ||
              disabled
            }
            className="pl-9 pr-3 py-2.5 text-xs font-semibold rounded-lg border-2 border-black bg-[#FFE600] text-stone-900 shadow-sticker-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493] cursor-pointer disabled:opacity-60"
          >
            {SUPPORTED_LANGUAGES.map(
              (language) => (
                <option
                  key={
                    language.code
                  }
                  value={
                    language.code
                  }
                >
                  {language.name}
                </option>
              )
            )}
          </select>

        </div>

        {recordingState ===
          'idle' && (
          <button
            id="start-voice-btn"
            type="button"
            onClick={
              startRecording
            }
            disabled={disabled}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-[#FF1493] hover:bg-[#ff2a85] text-white font-bold text-sm tracking-wide border-2 border-black shadow-sticker transition-all active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic className="w-4 h-4 text-[#FFE600]" />

            <span>
              Speak your question
            </span>
          </button>
        )}

        {recordingState ===
          'recording' && (
          <button
            id="stop-voice-btn"
            type="button"
            onClick={
              handleManualStop
            }
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm border-2 border-black shadow-sticker animate-pulse"
          >
            <MicOff className="w-4 h-4" />

            <span>
              Finish Speaking
            </span>
          </button>
        )}

        {recordingState ===
          'transcribing' && (
          <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-[#FFE600] text-black font-bold text-sm border-2 border-black shadow-sticker-sm">
            <Loader2 className="w-4 h-4 animate-spin" />

            <span>
              Transcribing...
            </span>
          </div>
        )}

      </div>

      {recordingState ===
        'recording' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-2 mt-1">

          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[#062817] border border-[#FFE600]/40 text-xs">

            <div className="flex items-center gap-2 text-[#FFE600] font-bold">

              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />

              <span>
                Listening...
              </span>

            </div>

            <div className="flex items-center gap-1 h-5 w-24 px-1.5 bg-black/40 rounded border border-[#FFE600]/30">

              {[
                0.15,
                0.3,
                0.45,
                0.6,
                0.75,
                0.9,
              ].map(
                (
                  step,
                  index
                ) => (
                  <div
                    key={index}
                    className="flex-1 rounded-xs transition-all duration-75"
                    style={{
                      height: `${Math.max(
                        20,
                        audioLevel >=
                          step
                          ? 100
                          : audioLevel *
                            100
                      )}%`,

                      backgroundColor:
                        audioLevel >=
                        step
                          ? '#FFE600'
                          : '#0d5934',
                    }}
                  />
                )
              )}

            </div>

          </div>

          {liveTranscript.trim() !==
            '' && (
            <div className="w-full text-center text-sm font-medium text-white bg-black/70 border-2 border-[#FF1493]/70 px-4 py-3 rounded-lg">

              <span className="text-[#FFE600] text-xs font-bold block mb-1">
                LIVE TRANSCRIPT
              </span>

              <span>
                "{liveTranscript}"
              </span>

            </div>
          )}

        </div>
      )}

      {recordingState ===
        'idle' &&
        currentTranscript && (
          <div className="text-xs text-stone-800 bg-[#FFE600] border border-black px-3 py-1 rounded-md font-medium shadow-sticker-sm">

            Heard:{' '}

            <span className="font-bold">
              "{currentTranscript}"
            </span>

          </div>
        )}

      {voiceError && (
        <div className="text-xs text-amber-200 bg-black/60 border border-amber-400/40 px-3 py-1.5 rounded-md">
          {voiceError}
        </div>
      )}

    </div>
  );
};