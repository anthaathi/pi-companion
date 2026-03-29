import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useSpeechSettingsStore } from '../store';

interface UseSpeechRecognitionResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  audioLevel: number;
}

export function useSpeechRecognition(
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const clearError = useCallback(() => setError(null), []);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelFrameRef = useRef<number>(0);

  const mode = useSpeechSettingsStore((s) => s.mode);
  const apiBaseUrl = useSpeechSettingsStore((s) => s.apiBaseUrl);
  const apiKey = useSpeechSettingsStore((s) => s.apiKey);
  const model = useSpeechSettingsStore((s) => s.model);

  const useRealtimeWs = useSpeechSettingsStore((s) => s.useRealtimeWs);
  const wsModel = useSpeechSettingsStore((s) => s.wsModel);

  const webRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const onInterimRef = useRef(onInterim);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  const sessionRef = useRef(0);

  // Native audio recorder (hook must be called unconditionally)
  const nativeRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(nativeRecorder, 100);

  // Convert native metering (dBFS: -160 to 0) to 0-1 range
  useEffect(() => {
    if (Platform.OS === 'web' || !isListening) return;
    const db = recorderState.metering ?? -160;
    // Map -60..0 dBFS to 0..1 (below -60 is effectively silence)
    const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
    setAudioLevel(normalized);
  }, [recorderState.metering, isListening]);

  const startMetering = useCallback((stream: MediaStream) => {
    if (Platform.OS !== 'web') return;
    try {
      const ctx = audioContextRef.current ?? new AudioContext();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length / 255;
        setAudioLevel(avg);
        levelFrameRef.current = requestAnimationFrame(tick);
      };
      levelFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // metering is best-effort
    }
  }, []);

  const stopMetering = useCallback(() => {
    if (levelFrameRef.current) {
      cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = 0;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // --- Built-in: Web Speech API — realtime with interim results ---
  const startBuiltinWeb = useCallback(() => {
    const session = ++sessionRef.current;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      if (sessionRef.current !== session) return;
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) onFinalRef.current(final);
      if (interim) onInterimRef.current(interim);
    };
    recognition.onerror = (event: any) => {
      if (sessionRef.current !== session) return;
      if (event.error !== 'aborted') {
        setError(event.error || 'Recognition failed');
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      if (sessionRef.current !== session) return;
      setIsListening(false);
    };

    webRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setError(null);

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream;
      startMetering(stream);
    }).catch(() => {});
  }, [startMetering]);

  // --- API mode on web: record full audio, transcribe on stop ---
  const startApiWeb = useCallback(async () => {
    try {
      ++sessionRef.current;
      setError(null);
      chunksRef.current = [];

      if (!apiKey) {
        setError('API key not configured. Go to Settings > Speech.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsListening(true);
      startMetering(stream);
    } catch (e: any) {
      setError(e.message || 'Microphone access denied');
    }
  }, [apiKey, startMetering]);

  const stopApiWeb = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      setIsListening(false);
      return;
    }

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        setIsListening(false);
        mediaRecorderRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          resolve();
          return;
        }

        try {
          const baseUrl = apiBaseUrl.replace(/\/+$/, '');
          const nativeFetch = window.fetch.bind(window);
          const fd = new window.FormData();
          fd.append('file', new File([blob], 'recording.webm', { type: mimeType }));
          fd.append('model', model);

          const response = await nativeFetch(`${baseUrl}/audio/transcriptions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: fd,
          });

          if (!response.ok) {
            setError(`Transcription failed: ${response.status}`);
            resolve();
            return;
          }

          const data = await response.json();
          if (data.text && data.text.trim()) {
            onFinalRef.current(data.text.trim());
          }
        } catch (e: any) {
          setError(e.message || 'Transcription failed');
        }
        resolve();
      };
      mediaRecorder.stop();
    });
  }, [apiBaseUrl, apiKey, model]);

  // --- API mode on native: use expo-audio useAudioRecorder ---
  const startApiNative = useCallback(async () => {
    try {
      ++sessionRef.current;
      setError(null);

      if (!apiKey) {
        setError('API key not configured. Go to Settings > Speech.');
        return;
      }

      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setError('Microphone permission denied');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await nativeRecorder.prepareToRecordAsync();
      nativeRecorder.record();
      setIsListening(true);
    } catch (e: any) {
      setError(e.message || 'Failed to start recording');
    }
  }, [apiKey, nativeRecorder]);

  const stopApiNative = useCallback(async () => {
    try {
      await nativeRecorder.stop();
      setIsListening(false);

      const uri = nativeRecorder.uri;
      if (!uri) {
        setError('No audio recorded');
        return;
      }

      const ext = uri.split('.').pop() || 'm4a';
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: `audio/${ext === 'caf' ? 'm4a' : ext}`,
        name: `recording.${ext}`,
      } as any);
      formData.append('model', model);

      const baseUrl = apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        setError(`Transcription failed: ${response.status}`);
        return;
      }

      const data = await response.json();
      if (data.text) onFinalRef.current(data.text.trim());
    } catch (e: any) {
      setError(e.message || 'Transcription failed');
    }
  }, [nativeRecorder, apiBaseUrl, apiKey, model]);

  // --- WebSocket streaming transcription (OpenAI Realtime Transcription API) ---
  const startWsRealtime = useCallback(async () => {
    try {
      const session = ++sessionRef.current;
      setError(null);

      if (!apiKey) {
        setError('API key not configured. Go to Settings > Speech.');
        return;
      }

      // Connect to transcription-specific endpoint
      const baseUrl = apiBaseUrl.replace(/\/+$/, '');
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/realtime?intent=transcription';
      const ws = new WebSocket(wsUrl, [
        'realtime',
        `openai-insecure-api-key.${apiKey}`,
        'openai-beta.realtime-v1',
      ]);
      wsRef.current = ws;

      ws.onopen = () => {
        // Configure transcription session with server VAD
        ws.send(JSON.stringify({
          type: 'transcription_session.update',
          session: {
            input_audio_format: 'pcm16',
            input_audio_transcription: {
              model: wsModel,
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        }));
      };

      let interimAccumulator = '';
      ws.onmessage = (event) => {
        try {
          if (sessionRef.current !== session) return;
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
          console.log('[WS-STT]', msg.type, msg.delta ?? msg.transcript ?? '');
          if (msg.type === 'conversation.item.input_audio_transcription.delta') {
            if (msg.delta) {
              interimAccumulator += msg.delta;
              console.log('[WS-STT] interim so far:', JSON.stringify(interimAccumulator));
              onInterimRef.current(interimAccumulator);
            }
          } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('[WS-STT] completed:', JSON.stringify(msg.transcript), '| interim was:', JSON.stringify(interimAccumulator));
            interimAccumulator = '';
            if (msg.transcript?.trim()) onFinalRef.current(msg.transcript.trim());
          } else if (msg.type === 'input_audio_buffer.speech_started') {
            interimAccumulator = '';
            console.log('[WS-STT] speech_started');
          } else if (msg.type === 'input_audio_buffer.speech_stopped') {
            console.log('[WS-STT] speech_stopped');
          } else if (msg.type === 'error') {
            console.error('[WS-STT] error:', msg.error);
            setError(msg.error?.message || 'Realtime API error');
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed');
        setIsListening(false);
      };

      ws.onclose = () => {
        setIsListening(false);
      };

      // Get microphone and stream PCM16 audio at 24kHz
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: btoa(binary),
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      startMetering(stream);
      setIsListening(true);
    } catch (e: any) {
      setError(e.message || 'Failed to start realtime transcription');
    }
  }, [apiKey, apiBaseUrl, wsModel, startMetering]);

  const stopWsRealtime = useCallback(async () => {
    audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const ws = wsRef.current;
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    }

    setIsListening(false);
  }, []);

  // --- Public interface ---
  const start = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (mode === 'builtin') {
        startBuiltinWeb();
      } else if (useRealtimeWs) {
        await startWsRealtime();
      } else {
        await startApiWeb();
      }
    } else {
      if (mode === 'builtin') {
        setError('Built-in speech not available on mobile. Switch to API mode in Settings.');
      } else {
        await startApiNative();
      }
    }
  }, [mode, useRealtimeWs, startBuiltinWeb, startApiWeb, startWsRealtime, startApiNative]);

  const stop = useCallback(async () => {
    stopMetering();
    // Clean up metering stream for builtin mode
    if (streamRef.current && mode === 'builtin') {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (Platform.OS === 'web') {
      if (mode === 'builtin' && webRecognitionRef.current) {
        webRecognitionRef.current.abort();
        webRecognitionRef.current = null;
        setIsListening(false);
      } else if (mode === 'api' && useRealtimeWs) {
        await stopWsRealtime();
      } else if (mode === 'api') {
        await stopApiWeb();
      }
    } else {
      if (mode === 'api') {
        await stopApiNative();
      } else {
        setIsListening(false);
      }
    }
  }, [mode, useRealtimeWs, stopApiWeb, stopWsRealtime, stopApiNative, stopMetering]);

  return { isListening, start, stop, error, clearError, audioLevel };
}
