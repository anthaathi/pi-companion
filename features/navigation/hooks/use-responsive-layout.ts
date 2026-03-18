import { useWindowDimensions } from 'react-native';

const WIDE_SCREEN_BREAKPOINT = 768;

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  return {
    isWideScreen: width >= WIDE_SCREEN_BREAKPOINT,
    screenWidth: width,
  };
}
