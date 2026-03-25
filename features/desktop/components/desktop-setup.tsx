import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Monitor,
  Play,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ScreenShare,
  MonitorUp,
} from 'lucide-react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useDesktopStore,
  type DesktopMode,
} from '../store';

export function DesktopSetup() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme];

  const backends = useDesktopStore((s) => s.backends);
  const desktopEnvironments = useDesktopStore((s) => s.desktopEnvironments);
  const currentDesktop = useDesktopStore((s) => s.currentDesktop);
  const backendsLoaded = useDesktopStore((s) => s.backendsLoaded);
  const loading = useDesktopStore((s) => s.loading);
  const desktopInfo = useDesktopStore((s) => s.desktopInfo);
  const fetchBackends = useDesktopStore((s) => s.fetchBackends);
  const startActual = useDesktopStore((s) => s.startActual);
  const startVirtual = useDesktopStore((s) => s.startVirtual);

  const [selectedMode, setSelectedMode] = useState<DesktopMode | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<string | null>(null);
  const [selectedDE, setSelectedDE] = useState<string | null>(null);

  const isWayland = currentDesktop.session_type === 'wayland';
  const hasX11vnc = backends.some((b) => b.id === 'x11vnc' && b.available);
  const hasWayvnc = backends.some((b) => b.id === 'wayvnc' && b.available);
  const hasKrfb = backends.some((b) => b.id === 'krfb' && b.available);
  const canShareActual = isWayland ? (hasWayvnc || hasKrfb) : hasX11vnc;
  const virtualBackends = backends.filter((b) => b.id !== 'wayvnc' && b.id !== 'krfb');
  const availableVirtualBackends = virtualBackends.filter((b) => b.available);
  const availableDEs = desktopEnvironments.filter((d) => d.available);

  useEffect(() => {
    if (!backendsLoaded) {
      fetchBackends();
    }
  }, [backendsLoaded, fetchBackends]);

  useEffect(() => {
    if (backendsLoaded && selectedMode === null) {
      setSelectedMode(canShareActual ? 'actual' : 'virtual');
    }
  }, [backendsLoaded, selectedMode, canShareActual]);

  useEffect(() => {
    if (availableVirtualBackends.length > 0 && !selectedBackend) {
      setSelectedBackend(availableVirtualBackends[0].id);
    }
  }, [availableVirtualBackends, selectedBackend]);

  useEffect(() => {
    if (availableDEs.length > 0 && !selectedDE) {
      setSelectedDE(availableDEs[0].id);
    }
  }, [availableDEs, selectedDE]);

  const handleStart = useCallback(() => {
    if (selectedMode === 'actual') {
      startActual();
    } else if (selectedBackend && selectedDE) {
      startVirtual(selectedBackend, selectedDE);
    }
  }, [selectedMode, selectedBackend, selectedDE, startActual, startVirtual]);

  const canStart =
    selectedMode === 'actual'
      ? canShareActual
      : selectedBackend && selectedDE;

  const cardBg = isDark ? '#1E1E1E' : '#F6F6F6';
  const selectedBg = isDark ? '#2A2A2A' : '#E8E8E8';
  const selectedBorder = isDark ? '#555' : '#AAA';

  if (!backendsLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Detecting available backends...
        </Text>
      </View>
    );
  }

  if (availableVirtualBackends.length === 0 && !canShareActual) {
    return (
      <View style={styles.centered}>
        <AlertCircle size={48} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          No VNC Backend Found
        </Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Install one of: x11vnc, TigerVNC (Xvnc), or TurboVNC to use the
          desktop feature.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Monitor size={40} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>
          Remote Desktop
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Share your current screen or start an isolated virtual desktop
        </Text>
      </View>

      {desktopInfo.error && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: isDark ? '#3A1A1A' : '#FFF0F0' },
          ]}
        >
          <AlertCircle size={16} color={colors.destructive} />
          <Text
            style={[styles.errorBannerText, { color: colors.destructive }]}
          >
            {desktopInfo.error}
          </Text>
        </View>
      )}

      {/* --- Mode selection --- */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Mode</Text>
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setSelectedMode('actual')}
          style={[
            styles.modeCard,
            {
              backgroundColor:
                selectedMode === 'actual' ? selectedBg : cardBg,
              borderColor:
                selectedMode === 'actual' ? selectedBorder : 'transparent',
              opacity: canShareActual ? 1 : 0.4,
            },
          ]}
          disabled={!canShareActual}
        >
          <ScreenShare
            size={22}
            color={
              selectedMode === 'actual' ? colors.text : colors.textTertiary
            }
          />
          <Text style={[styles.modeTitle, { color: colors.text }]}>
            Actual Desktop
          </Text>
          <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>
            Share your current screen
            {currentDesktop.running_de
              ? ` (${currentDesktop.running_de})`
              : ''}
            {currentDesktop.display
              ? ` on ${currentDesktop.display}`
              : ''}
            {isWayland ? ' — Wayland' : ''}
          </Text>
          {!canShareActual && (
            <Text style={[styles.modeWarn, { color: colors.destructive }]}>
              {isWayland
                ? 'Requires wayvnc (wlroots) or krfb (KDE)'
                : 'Requires x11vnc'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setSelectedMode('virtual')}
          style={[
            styles.modeCard,
            {
              backgroundColor:
                selectedMode === 'virtual' ? selectedBg : cardBg,
              borderColor:
                selectedMode === 'virtual' ? selectedBorder : 'transparent',
            },
          ]}
        >
          <MonitorUp
            size={22}
            color={
              selectedMode === 'virtual' ? colors.text : colors.textTertiary
            }
          />
          <Text style={[styles.modeTitle, { color: colors.text }]}>
            Virtual Desktop
          </Text>
          <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>
            Start an isolated virtual display with a separate DE
          </Text>
        </Pressable>
      </View>

      {/* --- Virtual mode options --- */}
      {selectedMode === 'virtual' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            VNC Backend
          </Text>
          <View style={styles.optionsGrid}>
            {virtualBackends.map((backend) => (
              <Pressable
                key={backend.id}
                onPress={() =>
                  backend.available && setSelectedBackend(backend.id)
                }
                style={[
                  styles.optionCard,
                  {
                    backgroundColor:
                      selectedBackend === backend.id ? selectedBg : cardBg,
                    borderColor:
                      selectedBackend === backend.id
                        ? selectedBorder
                        : 'transparent',
                    opacity: backend.available ? 1 : 0.4,
                  },
                ]}
              >
                {backend.available ? (
                  <CheckCircle2
                    size={16}
                    color={
                      selectedBackend === backend.id
                        ? colors.success
                        : colors.textTertiary
                    }
                  />
                ) : (
                  <XCircle size={16} color={colors.textTertiary} />
                )}
                <Text style={[styles.optionName, { color: colors.text }]}>
                  {backend.name}
                </Text>
                <Text
                  style={[styles.optionDetail, { color: colors.textTertiary }]}
                >
                  {backend.available ? 'Installed' : 'Not installed'}
                </Text>
              </Pressable>
            ))}
          </View>

          {availableDEs.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Desktop Environment
              </Text>
              <View style={styles.optionsGrid}>
                {desktopEnvironments.map((de) => (
                  <Pressable
                    key={de.id}
                    onPress={() => de.available && setSelectedDE(de.id)}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor:
                          selectedDE === de.id ? selectedBg : cardBg,
                        borderColor:
                          selectedDE === de.id
                            ? selectedBorder
                            : 'transparent',
                        opacity: de.available ? 1 : 0.4,
                      },
                    ]}
                  >
                    {de.available ? (
                      <CheckCircle2
                        size={16}
                        color={
                          selectedDE === de.id
                            ? colors.success
                            : colors.textTertiary
                        }
                      />
                    ) : (
                      <XCircle size={16} color={colors.textTertiary} />
                    )}
                    <Text style={[styles.optionName, { color: colors.text }]}>
                      {de.name}
                    </Text>
                    <Text
                      style={[
                        styles.optionDetail,
                        { color: colors.textTertiary },
                      ]}
                    >
                      {de.available ? 'Available' : 'Not installed'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {availableDEs.length === 0 && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: isDark ? '#3A2A1A' : '#FFF8F0' },
              ]}
            >
              <AlertCircle size={16} color={colors.notificationDot} />
              <Text
                style={[
                  styles.errorBannerText,
                  { color: colors.notificationDot },
                ]}
              >
                No desktop environment detected. Install one (e.g. XFCE,
                Openbox, Fluxbox) to use virtual desktop mode.
              </Text>
            </View>
          )}
        </>
      )}

      <Pressable
        onPress={handleStart}
        disabled={!canStart || loading}
        style={({ pressed }) => [
          styles.startButton,
          {
            backgroundColor: isDark ? '#E8E8E8' : '#1A1A1A',
            opacity: !canStart || loading ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={isDark ? '#1A1A1A' : '#FFFFFF'}
          />
        ) : (
          <Play size={18} color={isDark ? '#1A1A1A' : '#FFFFFF'} />
        )}
        <Text
          style={[
            styles.startButtonText,
            { color: isDark ? '#1A1A1A' : '#FFFFFF' },
          ]}
        >
          {loading
            ? 'Starting...'
            : selectedMode === 'actual'
              ? 'Share Desktop'
              : 'Start Virtual Desktop'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: Fonts.sansSemiBold,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    textAlign: 'center',
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    paddingTop: 32,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.sansSemiBold,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.sansMedium,
    marginBottom: 10,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  modeCard: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  modeTitle: {
    fontSize: 14,
    fontFamily: Fonts.sansMedium,
  },
  modeDesc: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    lineHeight: 17,
  },
  modeWarn: {
    fontSize: 11,
    fontFamily: Fonts.sansMedium,
    marginTop: 2,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    minWidth: 160,
  },
  optionName: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
  optionDetail: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 12,
  },
  startButtonText: {
    fontSize: 15,
    fontFamily: Fonts.sansMedium,
  },
});
