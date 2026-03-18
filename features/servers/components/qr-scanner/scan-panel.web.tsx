import { StyleSheet, Text, View } from "react-native";
import { QrCode } from "lucide-react-native";

import { Fonts } from "@/constants/theme";

interface QrScannerScanPanelProps {
  textMuted: string;
}

export function QrScannerScanPanel({ textMuted }: QrScannerScanPanelProps) {
  return (
    <View style={styles.permissionWrap}>
      <QrCode size={36} color={textMuted} strokeWidth={1.2} />
      <Text style={[styles.permissionText, { color: textMuted }]}>
        Camera scanning is only available in the iOS and Android app. Paste the
        connect URL manually.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionWrap: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  permissionText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
});
