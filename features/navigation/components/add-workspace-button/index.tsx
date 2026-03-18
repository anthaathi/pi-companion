import { Pressable, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AddWorkspaceButtonProps {
  onPress: () => void;
  layout?: 'vertical' | 'horizontal';
}

export function AddWorkspaceButton({
  onPress,
  layout = 'vertical',
}: AddWorkspaceButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.wrapper,
        layout === 'vertical' ? styles.wrapperVertical : styles.wrapperHorizontal,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.4 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add workspace"
      >
        <Plus size={20} color={colors.iconMuted} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperVertical: {
    alignSelf: 'stretch',
    height: 44,
  },
  wrapperHorizontal: {
    width: 50,
    height: 54,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
