import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useSpeechSettingsStore } from '../store';

interface UseSpeechRecognitionResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  error: string | null;
  audioLevel: number;
}

export function useSpeechRecognition(
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
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
      if (final) onFinal(final);
      if (interim) onInterim(interim);
    };
    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        setError(event.error || 'Recognition failed');
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    webRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setError(null);

    // Start metering for waveform
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream;
      startMetering(stream);
    }).catch(() => {});
  }, [onInterim, onFinal, startMetering]);

  // --- API mode on web: record full audio, transcribe on stop ---
  const startApiWeb = useCallback(async () => {
    try {
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
            onFinal(data.text.trim());
          }
        } catch (e: any) {
          setError(e.message || 'Transcription failed');
        }
        resolve();
      };
      mediaRecorder.stop();
    });
  }, [apiBaseUrl, apiKey, model, onFinal]);

  // --- API mode on native: use expo-audio useAudioRecorder ---
  const startApiNative = useCallback(async () => {
    try {
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
      if (data.text) onFinal(data.text.trim());
    } catch (e: any) {
      setError(e.message || 'Transcription failed');
    }
  }, [nativeRecorder, apiBaseUrl, apiKey, model, onFinal]);

  // --- WebSocket streaming transcription (OpenAI Realtime Transcription API) ---
  const startWsRealtime = useCallback(async () => {
    try {
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

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
          if (msg.type === 'conversation.item.input_audio_transcription.delta') {
            if (msg.delta) onInterim(msg.delta);
          } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            if (msg.transcript?.trim()) onFinal(msg.transcript.trim());
          } else if (msg.type === 'error') {
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
  }, [apiKey, apiBaseUrl, wsModel, onInterim, onFinal, startMetering]);

  const stopWsRealtime = useCallback(async () => {
    // Stop audio capture
    audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Commit remaining buffer, wait for final transcript, then close
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      setTimeout(() => {
        ws.close();
        wsRef.current = null;
      }, 2000);
    } else {
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
        webRecognitionRef.current.stop();
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

  return { isListening, start, stop, error, audioLevel };
}
