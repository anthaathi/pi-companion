import { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Settings, CircleHelp, Server } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ICON_MAP = {
  settings: Settings,
  'help-outline': CircleHelp,
  server: Server,
} as const;

interface RailItemProps {
  icon: keyof typeof ICON_MAP;
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export function RailItem({ icon, label, isActive, onPress }: RailItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const IconComponent = ICON_MAP[icon];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.5 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <IconComponent
        size={20}
        color={isActive ? colors.text : colors.icon}
        strokeWidth={1.8}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
