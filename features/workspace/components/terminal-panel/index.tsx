import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Plus } from 'lucide-react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function TerminalPanel() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const isDark = colorScheme === 'dark';
  const surfaceBg = isDark ? '#151515' : '#FAFAFA';
  const topBorder = isDark ? '#000000' : 'rgba(0,0,0,0.15)';
  const tabDivider = isDark ? '#323131' : 'rgba(0,0,0,0.08)';
  const activeTabBorder = isDark ? '#ede8e4' : '#1A1A1A';
  const textPrimary = isDark ? '#fefdfd' : colors.text;
  const textMuted = isDark ? '#cdc8c5' : colors.textTertiary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: surfaceBg,
          borderTopColor: topBorder,
        },
      ]}
    >
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: tabDivider }]}>
        <View style={styles.tabBarLeft}>
          <View style={[styles.tab, { borderBottomColor: activeTabBorder }]}>
            <Text style={[styles.tabText, { color: textPrimary }]}>
              Terminal 1
            </Text>
            <Pressable style={styles.tabClose}>
              <X size={12} color={textMuted} strokeWidth={2} />
            </Pressable>
          </View>

          <Pressable style={styles.addTabButton}>
            <Plus size={18} color={textMuted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>

      {/* Terminal content */}
      <View style={styles.terminalContent}>
        <Text
          style={[
            styles.terminalLine,
            { color: textMuted, fontFamily: Fonts.mono },
          ]}
        >
          <Text style={{ color: isDark ? '#30D158' : '#34C759' }}>~</Text>{' '}
          <Text style={{ color: textPrimary }}>$</Text> _
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderTopWidth: 0.633,
  },
  tabBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 0.633,
    paddingHorizontal: 24,
  },
  tabBarLeft: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1.9,
    marginBottom: -0.633,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  tabClose: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabButton: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  terminalLine: {
    fontSize: 13,
    lineHeight: 20,
  },
});
