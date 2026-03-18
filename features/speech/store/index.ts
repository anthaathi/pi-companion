import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'speech_settings';

export type SpeechMode = 'builtin' | 'api';

interface SpeechSettings {
  mode: SpeechMode;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  useRealtimeWs: boolean;
  wsModel: string;
}

interface SpeechSettingsState extends SpeechSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (settings: Partial<SpeechSettings>) => Promise<void>;
}

const DEFAULTS: SpeechSettings = {
  mode: 'builtin',
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'whisper-1',
  useRealtimeWs: false,
  wsModel: 'gpt-4o-transcribe',
};

async function readFromStore(): Promise<Partial<SpeechSettings>> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeToStore(settings: SpeechSettings) {
  try {
    const json = JSON.stringify(settings);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, json);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, json);
    }
  } catch {
    // silently fail
  }
}

export const useSpeechSettingsStore = create<SpeechSettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const stored = await readFromStore();
    set({ ...DEFAULTS, ...stored, loaded: true });
  },

  update: async (partial) => {
    const current = get();
    const next: SpeechSettings = {
      mode: partial.mode ?? current.mode,
      apiBaseUrl: partial.apiBaseUrl ?? current.apiBaseUrl,
      apiKey: partial.apiKey ?? current.apiKey,
      model: partial.model ?? current.model,
      useRealtimeWs: partial.useRealtimeWs ?? current.useRealtimeWs,
      wsModel: partial.wsModel ?? current.wsModel,
    };
    set(next);
    await writeToStore(next);
  },
}));
