import { Alert, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile, Paths } from "expo-file-system";
import type { ApiClient } from "@pi-ui/client";

export type UploadItemStatus = "pending" | "uploading" | "success" | "error";

export interface UploadProgressItem {
  id: string;
  name: string;
  size: number | null;
  loaded: number;
  progress: number;
  status: UploadItemStatus;
  path?: string;
  error?: string;
}

export interface UploadProgressSnapshot {
  items: UploadProgressItem[];
  uploading: boolean;
  completed: number;
  total: number;
  totalProgress: number;
}

function createInitialSnapshot(
  assets: DocumentPicker.DocumentPickerAsset[],
): UploadProgressSnapshot {
  const items = assets.map((asset, index) => ({
    id: `${Date.now()}-${index}-${asset.name}`,
    name: asset.name,
    size: asset.size ?? null,
    loaded: 0,
    progress: 0,
    status: "pending" as const,
  }));

  return {
    items,
    uploading: true,
    completed: 0,
    total: items.length,
    totalProgress: 0,
  };
}

function calculateTotalProgress(items: UploadProgressItem[]): number {
  const withKnownSize = items.filter((item) => item.size && item.size > 0);
  if (withKnownSize.length > 0) {
    const totalBytes = withKnownSize.reduce((sum, item) => sum + (item.size ?? 0), 0);
    const loadedBytes = withKnownSize.reduce((sum, item) => sum + Math.min(item.loaded, item.size ?? 0), 0);
    return totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
  }

  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.progress, 0);
  return Math.round(total / items.length);
}

function updateSnapshot(
  snapshot: UploadProgressSnapshot,
  index: number,
  patch: Partial<UploadProgressItem>,
): UploadProgressSnapshot {
  const items = snapshot.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item,
  );
  const completed = items.filter((item) => item.status === "success").length;
  const uploading = items.some(
    (item) => item.status === "pending" || item.status === "uploading",
  );

  return {
    items,
    completed,
    total: items.length,
    uploading,
    totalProgress: calculateTotalProgress(items),
  };
}

function createFormData(asset: DocumentPicker.DocumentPickerAsset): FormData {
  const formData = new FormData();

  if (Platform.OS === "web") {
    if (asset.file) {
      formData.append("files", asset.file);
      return formData;
    }

    throw new Error(`Missing File object for ${asset.name}`);
  }

  formData.append("files", {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? "application/octet-stream",
  } as any);

  return formData;
}

export async function pickAndUploadFiles(
  api: ApiClient,
  targetDir: string,
  onProgress?: (snapshot: UploadProgressSnapshot) => void,
): Promise<string[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
    type: "*/*",
  });

  if (result.canceled || !result.assets?.length) {
    onProgress?.({
      items: [],
      uploading: false,
      completed: 0,
      total: 0,
      totalProgress: 0,
    });
    return [];
  }

  let snapshot = createInitialSnapshot(result.assets);
  onProgress?.(snapshot);

  const uploaded: string[] = [];

  for (const [index, asset] of result.assets.entries()) {
    snapshot = updateSnapshot(snapshot, index, {
      status: "uploading",
      loaded: 0,
      progress: 0,
      error: undefined,
    });
    onProgress?.(snapshot);

    try {
      const response = await api.fsUpload({
        path: targetDir,
        createFormData: () => createFormData(asset),
        onProgress: (loaded, total) => {
          snapshot = updateSnapshot(snapshot, index, {
            loaded,
            size: total > 0 ? total : snapshot.items[index]?.size ?? null,
            progress: total > 0 ? Math.round((loaded / total) * 100) : snapshot.items[index]?.progress ?? 0,
            status: "uploading",
          });
          onProgress?.(snapshot);
        },
      });

      const file = response.files[0];
      if (!file?.success) {
        const error = file?.error ?? `Failed to upload ${asset.name}`;
        snapshot = updateSnapshot(snapshot, index, {
          status: "error",
          error,
          loaded: snapshot.items[index]?.size ?? snapshot.items[index]?.loaded ?? 0,
          progress: 100,
        });
        onProgress?.(snapshot);
        continue;
      }

      uploaded.push(file.path);
      snapshot = updateSnapshot(snapshot, index, {
        status: "success",
        path: file.path,
        loaded: file.size,
        size: file.size,
        progress: 100,
      });
      onProgress?.(snapshot);
    } catch (e) {
      const error = e instanceof Error ? e.message : "Upload failed";
      snapshot = updateSnapshot(snapshot, index, {
        status: "error",
        error,
      });
      onProgress?.(snapshot);
    }
  }

  snapshot = {
    ...snapshot,
    uploading: false,
    totalProgress: calculateTotalProgress(snapshot.items),
  };
  onProgress?.(snapshot);

  return uploaded;
}

export async function downloadFile(
  api: ApiClient,
  filePath: string,
  fileName?: string,
): Promise<void> {
  const result = await api.fsDownload(filePath);
  const resolvedName = fileName ?? result.fileName;

  if (Platform.OS === "web") {
    downloadFileWeb(result.data, resolvedName, result.contentType);
    return;
  }

  await downloadFileNative(result.data, resolvedName);
}

function downloadFileWeb(
  data: Uint8Array,
  fileName: string,
  contentType: string,
): void {
  const safeBuffer = Uint8Array.from(data).buffer as ArrayBuffer;
  const blob = new Blob([safeBuffer], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function downloadFileNative(
  data: Uint8Array,
  fileName: string,
): Promise<void> {
  try {
    const file = new ExpoFile(Paths.document, fileName);
    if (file.exists) {
      file.delete();
    }
    file.create({ intermediates: true, overwrite: true });
    file.write(data);
    Alert.alert("Downloaded", `Saved to app documents:\n${fileName}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    Alert.alert("Error", `Failed to save file: ${msg}`);
  }
}
