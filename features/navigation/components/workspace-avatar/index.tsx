import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const OUTER_SIZE = 40;
const INNER_SIZE = 32;
const OUTER_RADIUS = 8;
const INNER_RADIUS = 4;
const ACTIVE_BORDER = 1.9;
const DOT_SIZE = 7;

interface WorkspaceAvatarProps {
  title: string;
  color: string;
  isActive: boolean;
  hasNotification: boolean;
  onPress: () => void;
  layout?: 'vertical' | 'horizontal';
}

function getLighterColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, r + 80);
  const lg = Math.min(255, g + 80);
  const lb = Math.min(255, b + 80);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

export function WorkspaceAvatar({
  title,
  color,
  isActive,
  hasNotification,
  onPress,
  layout = 'vertical',
}: WorkspaceAvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const initial = title.charAt(0).toUpperCase();
  const isVertical = layout === 'vertical';
  const isDark = colorScheme === 'dark';

  const activeBorderColor = isDark ? '#ede8e4' : '#1A1A1A';
  const innerBorderColor = isDark ? '#3b3a39' : 'rgba(0,0,0,0.1)';
  const letterColor = getLighterColor(color);

  return (
    <View style={[styles.container, isVertical ? styles.vertical : styles.horizontal]}>
      <View style={styles.avatarWrap}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.outerAvatar,
            {
              borderColor: isActive ? activeBorderColor : 'transparent',
              borderWidth: ACTIVE_BORDER,
            },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ selected: isActive }}
        >
          <View
            style={[
              styles.innerAvatar,
              {
                backgroundColor: color,
                borderColor: innerBorderColor,
              },
            ]}
          >
            <Text style={[styles.initial, { color: letterColor }]}>{initial}</Text>
          </View>
        </Pressable>

        {hasNotification && (
          <View style={[styles.dotRing, { backgroundColor: colors.background }]}>
            <View style={[styles.dotInner, { backgroundColor: colors.notificationDot }]} />
          </View>
        )}
      </View>

      {!isVertical && isActive && (
        <View
          style={[
            styles.indicatorBottom,
            { backgroundColor: colors.activeIndicator },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vertical: {
    height: OUTER_SIZE + 12,
    alignSelf: 'stretch',
  },
  horizontal: {
    width: OUTER_SIZE + 14,
    height: OUTER_SIZE + 18,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerAvatar: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerAvatar: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_RADIUS,
    borderWidth: 0.633,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  indicatorBottom: {
    width: 20,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    position: 'absolute',
    bottom: 0,
  },
  dotRing: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: DOT_SIZE + 3,
    height: DOT_SIZE + 3,
    borderRadius: (DOT_SIZE + 3) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
