import { useEffect } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Mic, Globe, Key, Bot, Radio } from 'lucide-react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSpeechSettingsStore, SpeechMode } from '../../store';

export function SpeechSettings() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const { mode, apiBaseUrl, apiKey, model, useRealtimeWs, wsModel, loaded, load, update } =
    useSpeechSettingsStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const textPrimary = isDark ? '#fefdfd' : colors.text;
  const textMuted = isDark ? '#cdc8c5' : colors.textTertiary;
  const textSecondary = isDark ? '#f1ece8' : colors.textSecondary;
  const inputBg = isDark ? '#151515' : '#F6F6F6';
  const inputBorder = isDark ? '#3b3a39' : 'rgba(0,0,0,0.12)';
  const cardBg = isDark ? '#1a1a1a' : '#FFFFFF';
  const borderColor = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.08)';
  const activeBorder = isDark ? '#555' : '#CCC';

  const modes: { key: SpeechMode; label: string; desc: string }[] = [
    { key: 'builtin', label: 'Built-in', desc: 'Browser/device speech' },
    { key: 'api', label: 'API', desc: 'Whisper or compatible' },
  ];

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Mic size={15} color={textPrimary} strokeWidth={1.8} />
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>
          Speech Recognition
        </Text>
      </View>

      {/* Mode selector */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.fieldLabel, { color: textMuted }]}>Mode</Text>
        <View style={styles.modeRow}>
          {modes.map((m) => {
            const isActive = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => update({ mode: m.key })}
                style={({ pressed }) => [
                  styles.modeOption,
                  {
                    borderColor: isActive ? activeBorder : borderColor,
                    backgroundColor: isActive ? (isDark ? '#2a2a2a' : '#F0F0F0') : 'transparent',
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.modeLabel, { color: isActive ? textPrimary : textSecondary }]}>
                  {m.label}
                </Text>
                <Text style={[styles.modeDesc, { color: textMuted }]}>{m.desc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* API Configuration */}
      {mode === 'api' && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {/* Base URL */}
          <FieldRow
            icon={Globe}
            label="API Base URL"
            textMuted={textMuted}
            borderColor={borderColor}
          >
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={apiBaseUrl}
                onChangeText={(v) => update({ apiBaseUrl: v })}
                placeholder="https://api.openai.com/v1"
                placeholderTextColor={textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </FieldRow>

          {/* API Key */}
          <FieldRow
            icon={Key}
            label="API Key"
            textMuted={textMuted}
            borderColor={borderColor}
          >
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={apiKey}
                onChangeText={(v) => update({ apiKey: v })}
                placeholder="sk-..."
                placeholderTextColor={textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>
            <Text style={[styles.hint, { color: textMuted }]}>Stored securely on device</Text>
          </FieldRow>

          {/* Model */}
          <FieldRow
            icon={Bot}
            label="Model"
            textMuted={textMuted}
            borderColor={borderColor}
          >
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={model}
                onChangeText={(v) => update({ model: v })}
                placeholder="whisper-1"
                placeholderTextColor={textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </FieldRow>

          {/* Realtime toggle */}
          <View style={[styles.toggleRow, { borderTopColor: borderColor }]}>
            <View style={styles.toggleInfo}>
              <Radio size={14} color={textMuted} strokeWidth={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeLabel, { color: textPrimary }]}>Realtime Streaming</Text>
                <Text style={[styles.modeDesc, { color: textMuted }]}>
                  Stream transcription via WebSocket
                </Text>
              </View>
            </View>
            <Switch
              value={useRealtimeWs}
              onValueChange={(v) => update({ useRealtimeWs: v })}
              trackColor={{ false: isDark ? '#3b3a39' : '#E0E0E0', true: '#D71921' }}
            />
          </View>

          {/* WS Model */}
          {useRealtimeWs && (
            <FieldRow
              icon={Bot}
              label="Realtime Model"
              textMuted={textMuted}
              borderColor={borderColor}
              isLast
            >
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={wsModel}
                  onChangeText={(v) => update({ wsModel: v })}
                  placeholder="gpt-4o-transcribe"
                  placeholderTextColor={textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </FieldRow>
          )}
        </View>
      )}
    </View>
  );
}

function FieldRow({
  icon: Icon,
  label,
  textMuted,
  borderColor,
  isLast,
  children,
}: {
  icon: React.ComponentType<any>;
  label: string;
  textMuted: string;
  borderColor: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, !isLast && { borderBottomColor: borderColor, borderBottomWidth: 0 }]}>
      <View style={styles.fieldLabelRow}>
        <Icon size={13} color={textMuted} strokeWidth={1.8} />
        <Text style={[styles.fieldLabel, { color: textMuted }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  card: {
    borderRadius: 12,
    borderWidth: 0.633,
    padding: 16,
    gap: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.633,
  },
  modeLabel: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
  modeDesc: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    marginTop: 2,
  },
  field: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 8,
    borderWidth: 0.633,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.sans,
    outlineStyle: 'none',
  } as any,
  hint: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    marginTop: 2,
    paddingLeft: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.633,
    paddingTop: 14,
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
