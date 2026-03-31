import { memo, useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, View, Modal, Platform } from "react-native";
import type { ToolResultImage } from "../../../types";

interface ToolResultImagesProps {
  images: ToolResultImage[];
  isDark: boolean;
}

export const ToolResultImages = memo(function ToolResultImages({
  images,
  isDark,
}: ToolResultImagesProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const openPreview = useCallback((uri: string) => setPreviewUri(uri), []);
  const closePreview = useCallback(() => setPreviewUri(null), []);

  if (!images.length) return null;

  return (
    <>
      <View style={styles.container}>
        {images.map((img, i) => {
          const uri = img.data.startsWith("data:")
            ? img.data
            : `data:${img.mimeType};base64,${img.data}`;
          return (
            <Pressable
              key={i}
              onPress={() => openPreview(uri)}
              style={[
                styles.thumbWrap,
                { backgroundColor: isDark ? "#1a1a1a" : "#f0f0f0" },
              ]}
            >
              <Image source={{ uri }} style={styles.thumb} resizeMode="contain" />
            </Pressable>
          );
        })}
      </View>
      {previewUri && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closePreview}
        >
          <Pressable style={styles.overlay} onPress={closePreview}>
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginLeft: 12,
  },
  thumbWrap: {
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 400,
    maxHeight: 300,
  },
  thumb: {
    width: 320,
    height: 200,
    ...(Platform.OS === "web" ? { maxWidth: "100%" } : {}),
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewWrap: {
    width: "90%",
    height: "80%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});
