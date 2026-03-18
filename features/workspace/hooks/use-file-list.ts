import { useQuery } from '@tanstack/react-query';
import { list as fsList, read as fsRead } from '@/features/api/generated/sdk.gen';

function extract<T>(raw: unknown): T | undefined {
  const envelope = raw as Record<string, unknown> | null | undefined;
  if (envelope && 'data' in envelope && envelope.data != null) {
    return envelope.data as T;
  }
  return envelope as T | undefined;
}

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: string | null;
}

export interface FileContent {
  content: string;
  path: string;
  size: number;
  offset: number;
  length: number;
  truncated: boolean;
}

export function useFileRead(filePath: string | null) {
  return useQuery({
    queryKey: ['fs-read', filePath ?? ''],
    queryFn: async () => {
      const result = await fsRead({ query: { path: filePath! } });
      if (result.error) throw new Error('Failed to read file');
      return extract<FileContent>(result.data);
    },
    enabled: !!filePath,
    staleTime: 5_000,
  });
}

export function useFileList(dirPath: string | null) {
  return useQuery({
    queryKey: ['fs-list', dirPath ?? ''],
    queryFn: async () => {
      const result = await fsList({ query: { path: dirPath! } });
      if (result.error) throw new Error('Failed to list directory');
      const data = extract<{ entries: FsEntry[]; path: string; total: number }>(
        result.data,
      );
      return data?.entries ?? [];
    },
    enabled: !!dirPath,
    staleTime: 10_000,
  });
}
