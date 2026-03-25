import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Square } from 'lucide-react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/features/auth/store';
import { useServersStore } from '@/features/servers/store';
import { useDesktopStore } from '@/features/desktop/store';
import { DesktopSetup } from '@/features/desktop/components/desktop-setup';
import { VncViewer } from '@/features/desktop/components/vnc-viewer';

export default function DesktopScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme];

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

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStop = useCallback(() => {
    stopDesktop();
  }, [stopDesktop]);

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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.toolbarText, { color: colors.textSecondary }]}>
            {desktopInfo.mode === 'actual' ? 'Screen Share' : 'Virtual Desktop'}
            {' — '}
            {desktopInfo.display} (VNC :{desktopInfo.vnc_port})
          </Text>
          <Pressable
            onPress={handleStop}
            disabled={stopping}
            style={({ pressed }) => [
              styles.stopButton,
              {
                backgroundColor: isDark ? '#3A1A1A' : '#FFF0F0',
                opacity: stopping ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {stopping ? (
              <ActivityIndicator size={14} color={colors.destructive} />
            ) : (
              <Square size={14} color={colors.destructive} />
            )}
            <Text style={[styles.stopText, { color: colors.destructive }]}>
              {stopping ? 'Stopping...' : 'Stop'}
            </Text>
          </Pressable>
        </View>
        <VncViewer
          serverUrl={serverAddress}
          accessToken={accessToken}
          vncPort={desktopInfo.vnc_port}
          vncPassword={desktopInfo.vnc_password}
        />
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  toolbarText: {
    fontSize: 12,
    fontFamily: Fonts.mono,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stopText: {
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
  },
});
