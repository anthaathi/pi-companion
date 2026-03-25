import { usePathname } from 'expo-router';

export type AppMode = 'chat' | 'code' | 'desktop';

export function useAppMode(): AppMode {
  const pathname = usePathname();
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/desktop')) return 'desktop';
  return 'code';
}
