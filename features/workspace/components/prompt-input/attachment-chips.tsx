import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X, FileText, ImageIcon } from 'lucide-react-native';

import { Fonts } from '@/constants/theme';
import { Attachment } from './constants';
import { usePromptTheme } from './use-theme-colors';

interface AttachmentChipsProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function AttachmentChips({ attachments, onRemove }: AttachmentChipsProps) {
  const theme = usePromptTheme();

  if (attachments.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}
    >
      {attachments.map((att) => (
        <View
          key={att.id}
          style={[
            styles.chip,
            {
              backgroundColor: theme.isDark ? '#252525' : '#E8E8E8',
              borderColor: theme.isDark ? '#3b3a39' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {att.type === 'image' && att.preview ? (
            <Image source={{ uri: att.preview }} style={styles.thumb} />
          ) : att.type === 'image' ? (
            <ImageIcon size={14} color={theme.textMuted} strokeWidth={1.8} />
          ) : (
            <FileText size={14} color={theme.textMuted} strokeWidth={1.8} />
          )}
          <Text
            style={[styles.name, { color: theme.textPrimary }]}
            numberOfLines={1}
          >
            {att.name}
          </Text>
          {att.size != null && (
            <Text style={[styles.size, { color: theme.textMuted }]}>
              {att.size > 1024 * 1024
                ? `${(att.size / (1024 * 1024)).toFixed(1)}MB`
                : att.size > 1024
                  ? `${(att.size / 1024).toFixed(0)}KB`
                  : `${att.size}B`}
            </Text>
          )}
          <Pressable
            onPress={() => onRemove(att.id)}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${att.name}`}
          >
            <X size={12} color={theme.textMuted} strokeWidth={2} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    maxHeight: 48,
    paddingHorizontal: 10,
  },
  content: {
    gap: 6,
    paddingBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 6,
    paddingRight: 4,
    borderRadius: 8,
    borderWidth: 0.633,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  name: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    maxWidth: 120,
  },
  size: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  remove: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
