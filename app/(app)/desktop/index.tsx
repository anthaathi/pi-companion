import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Square } from 'lucide-react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/features/auth/store';
import { useServersStore } from '@/features/servers/store';
import { useDesktopStore } from '@/features/desktop/store';
import { DesktopSetup } from '@/features/desktop/components/desktop-setup';
import { VncViewer } from '@/features/desktop/components/vnc-viewer';
import { AppModeToggle } from '@/features/navigation/components/app-mode-toggle';

const TOOLBAR_AUTO_HIDE_MS = 4000;

export default function DesktopScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const activeServerId = useAuthStore((s) => s.activeServerId);
  const accessToken = useAuthStore((s) =>
    s.activeServerId ? s.tokens[s.activeServerId]?.accessToken ?? '' : '',
  );
  const serverAddress = useServersStore((s) =>
    activeServerId
      ? s.servers.find((srv) => srv.id === activeServerId)?.address ?? ''
      : '',
  );

  const desktopInfo = useDesktopStore((s) => s.desktopInfo);
  const loading = useDesktopStore((s) => s.loading);
  const stopping = useDesktopStore((s) => s.stopping);
  const fetchStatus = useDesktopStore((s) => s.fetchStatus);
  const stopDesktop = useDesktopStore((s) => s.stopDesktop);

  const isRunning = desktopInfo.status === 'running';

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (isRunning) {
      ScreenOrientation.unlockAsync();
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    };
  }, [isRunning]);

  const [immersive, setImmersive] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarOpacity = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToolbar = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setToolbarVisible(true);
    Animated.timing(toolbarOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(toolbarOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToolbarVisible(false);
      });
    }, TOOLBAR_AUTO_HIDE_MS);
  }, [toolbarOpacity]);

  // Auto-hide toolbar on mount when running
  useEffect(() => {
    if (!isRunning || immersive) return;
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(toolbarOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToolbarVisible(false);
      });
    }, TOOLBAR_AUTO_HIDE_MS);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isRunning, immersive, toolbarOpacity]);

  const handleStop = useCallback(() => {
    stopDesktop();
  }, [stopDesktop]);

  const handleToggleFullscreen = useCallback((fullscreen: boolean) => {
    setImmersive(fullscreen);
  }, []);

  const handleTapViewer = useCallback(() => {
    if (!toolbarVisible) {
      showToolbar();
    }
  }, [toolbarVisible, showToolbar]);

  if (loading || desktopInfo.status === 'starting') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          Starting desktop...
        </Text>
      </View>
    );
  }

  if (desktopInfo.status === 'running' && desktopInfo.vnc_port && serverAddress) {
    return (
      <View style={[styles.container, { backgroundColor: '#111' }]}>
        <VncViewer
          serverUrl={serverAddress}
          accessToken={accessToken}
          vncPort={desktopInfo.vnc_port}
          vncPassword={desktopInfo.vnc_password}
          onToggleFullscreen={handleToggleFullscreen}
          onTap={handleTapViewer}
        />
        {!immersive && (toolbarVisible || Platform.OS === 'web') && (
          <Animated.View
            style={[
              styles.overlayToolbar,
              { paddingTop: insets.top + 4, opacity: Platform.OS === 'web' ? 1 : toolbarOpacity },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.overlayToolbarInner} pointerEvents="auto">
              <AppModeToggle />
              <View style={styles.toolbarInfo}>
                <Text style={styles.toolbarText} numberOfLines={1}>
                  {desktopInfo.mode === 'actual' ? 'Screen Share' : 'Virtual Desktop'}
                  {' — '}
                  {desktopInfo.display}
                </Text>
              </View>
              <Pressable
                onPress={handleStop}
                disabled={stopping}
                style={({ pressed }) => [
                  styles.stopButton,
                  {
                    opacity: stopping ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                {stopping ? (
                  <ActivityIndicator size={12} color="#FF6B6B" />
                ) : (
                  <Square size={12} color="#FF6B6B" />
                )}
                <Text style={styles.stopText}>
                  {stopping ? 'Stopping...' : 'Stop'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <DesktopSetup />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  overlayToolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  overlayToolbarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
      default: {},
    }),
  },
  toolbarInfo: {
    flex: 1,
    marginHorizontal: 4,
  },
  toolbarText: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: '#999',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,100,100,0.15)',
  },
  stopText: {
    fontSize: 11,
    fontFamily: Fonts.sansMedium,
    color: '#FF6B6B',
  },
});
