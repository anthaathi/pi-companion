import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useAppSettingsStore } from '@/features/settings/store';

export function useColorScheme() {
  const systemScheme = useSystemColorScheme();
  const themeMode = useAppSettingsStore((s) => s.themeMode);

  if (themeMode === 'system') {
    return systemScheme;
  }
  return themeMode;
}
