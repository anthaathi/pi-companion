import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'app_settings';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppSettings {
  themeMode: ThemeMode;
  pushNotifications: boolean;
  soundEffects: boolean;
}

interface AppSettingsState extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (settings: Partial<AppSettings>) => Promise<void>;
}

const DEFAULTS: AppSettings = {
  themeMode: 'system',
  pushNotifications: true,
  soundEffects: false,
};

async function readFromStore(): Promise<Partial<AppSettings>> {
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

async function writeToStore(settings: AppSettings) {
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

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const stored = await readFromStore();
    set({ ...DEFAULTS, ...stored, loaded: true });
  },

  update: async (partial) => {
    const current = get();
    const next: AppSettings = {
      themeMode: partial.themeMode ?? current.themeMode,
      pushNotifications: partial.pushNotifications ?? current.pushNotifications,
      soundEffects: partial.soundEffects ?? current.soundEffects,
    };
    set(next);
    await writeToStore(next);
  },
}));
