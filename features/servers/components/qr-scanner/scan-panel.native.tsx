import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, type CameraMountError, useCameraPermissions } from "expo-camera";
import { QrCode } from "lucide-react-native";

import { Fonts } from "@/constants/theme";

interface QrScannerScanPanelProps {
  visible: boolean;
  scanned: boolean;
  isDark: boolean;
  textMuted: string;
  onBarcodeData: (data: string) => void;
}

export function QrScannerScanPanel({
  visible,
  scanned,
  isDark,
  textMuted,
  onBarcodeData,
}: QrScannerScanPanelProps) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [hasAskedOnce, setHasAskedOnce] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCameraReady(false);
      setMountError(null);
      setHasAskedOnce(false);
      return;
    }

    if (!permission || permission.granted || hasAskedOnce) {
      return;
    }

    if (permission.canAskAgain) {
      setHasAskedOnce(true);
      requestPermission();
    }
  }, [visible, permission, requestPermission, hasAskedOnce]);

  useEffect(() => {
    if (!visible) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        getPermission();
      }
    });

    return () => subscription.remove();
  }, [visible, getPermission]);

  if (!permission) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  if (!permission.granted) {
    const shouldOpenSettings = !permission.canAskAgain || hasAskedOnce;

    return (
      <View style={styles.permissionWrap}>
        <QrCode size={36} color={textMuted} strokeWidth={1.2} />
        <Text style={[styles.permissionText, { color: textMuted }]}>
          {shouldOpenSettings
            ? "Camera access is required. Please enable it in Settings."
            : "Camera access is required to scan QR codes."}
        </Text>
        <Pressable
          onPress={() => {
            if (shouldOpenSettings) {
              Linking.openSettings();
            } else {
              setHasAskedOnce(true);
              requestPermission();
            }
          }}
          style={[
            styles.permissionBtn,
            { backgroundColor: isDark ? "#fefdfd" : "#1a1a1a" },
          ]}
        >
          <Text
            style={[
              styles.permissionBtnText,
              { color: isDark ? "#1a1a1a" : "#fff" },
            ]}
          >
            {shouldOpenSettings ? "Open Settings" : "Grant Access"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        active={visible}
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : ({ data }) => onBarcodeData(data)}
        onCameraReady={() => {
          setCameraReady(true);
          setMountError(null);
        }}
        onMountError={(event: CameraMountError) => {
          setCameraReady(false);
          setMountError(event.message || "Camera preview could not start.");
        }}
      />
      {!cameraReady && !mountError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Starting camera...</Text>
        </View>
      )}
      {mountError && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>{mountError}</Text>
        </View>
      )}
      <View style={styles.viewfinder}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  loadingWrap: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraWrap: {
    height: 260,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  loadingText: {
    fontSize: 13,
    color: "#fff",
    fontFamily: Fonts.sans,
  },
  viewfinder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#fff",
  },
  cornerTL: {
    top: "25%",
    left: "20%",
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: "25%",
    right: "20%",
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: "25%",
    left: "20%",
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: "25%",
    right: "20%",
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 4,
  },
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
  permissionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  permissionBtnText: {
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
});
