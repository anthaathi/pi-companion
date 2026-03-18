import { useRef, useEffect } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Fonts } from '@/constants/theme';
import { SlashCommand } from './constants';
import { usePromptTheme } from './use-theme-colors';

interface SlashCommandDropdownProps {
  commands: SlashCommand[];
  selectedIndex: number;
  dropdownAnim: Animated.Value;
  onSelect: (command: SlashCommand) => void;
}

export function SlashCommandDropdown({
  commands,
  selectedIndex,
  dropdownAnim,
  onSelect,
}: SlashCommandDropdownProps) {
  const theme = usePromptTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * 36, animated: true });
  }, [selectedIndex]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.dropdownBg,
          borderColor: theme.dropdownBorder,
          opacity: dropdownAnim,
          transform: [
            {
              translateY: dropdownAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {commands.map((cmd, index) => (
          <Pressable
            key={cmd.name}
            onPress={() => onSelect(cmd)}
            accessibilityRole="menuitem"
            accessibilityLabel={`/${cmd.name} — ${cmd.description}`}
            accessibilityState={{ selected: index === selectedIndex }}
            style={({ pressed, hovered }: any) => [
              styles.item,
              index === selectedIndex && { backgroundColor: theme.selectedBg },
              (pressed || hovered) &&
                index !== selectedIndex && { backgroundColor: theme.hoverBg },
            ]}
          >
            <Text style={[styles.name, { color: theme.textPrimary }]}>
              /{cmd.name}
            </Text>
            <Text
              style={[styles.desc, { color: theme.textMuted }]}
              numberOfLines={1}
            >
              {cmd.description}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 0.633,
    borderBottomWidth: 0,
    overflow: 'hidden',
    zIndex: 2,
  },
  scroll: {
    maxHeight: 260,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 36,
    gap: 12,
  },
  name: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
    minWidth: 80,
  },
  desc: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    flex: 1,
  },
});
