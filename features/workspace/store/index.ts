import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Workspace } from '../types';
import type { Workspace as ApiWorkspace } from '@/features/api/generated/types.gen';
import { list2 as list, create as apiCreate, delete2 as apiDelete } from '@/features/api/generated/sdk.gen';
import { unwrapApiData } from '@/features/api/unwrap';
import { WorkspaceColors } from '@/constants/theme';

const SELECTED_WORKSPACE_KEY = 'selected_workspace_id';
const LAST_SESSION_KEY = 'last_session_by_workspace';

async function readSelectedId(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(SELECTED_WORKSPACE_KEY);
    }
    return await SecureStore.getItemAsync(SELECTED_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

async function writeSelectedId(id: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (id) localStorage.setItem(SELECTED_WORKSPACE_KEY, id);
      else localStorage.removeItem(SELECTED_WORKSPACE_KEY);
    } else {
      if (id) await SecureStore.setItemAsync(SELECTED_WORKSPACE_KEY, id);
      else await SecureStore.deleteItemAsync(SELECTED_WORKSPACE_KEY);
    }
  } catch {}
}

async function readLastSessionMap(): Promise<Record<string, string>> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(LAST_SESSION_KEY);
      return raw ? JSON.parse(raw) : {};
    }
    const raw = await SecureStore.getItemAsync(LAST_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeLastSessionMap(map: Record<string, string>) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(map));
      return;
    }
    await SecureStore.setItemAsync(LAST_SESSION_KEY, JSON.stringify(map));
  } catch {}
}

function mapApiWorkspace(ws: ApiWorkspace, index: number): Workspace {
  return {
    id: ws.id,
    title: ws.name,
    path: ws.path,
    color: ws.color ?? WorkspaceColors[index % WorkspaceColors.length],
    runningSessions: 0,
    hasNotifications: false,
    worktreeEnabled: ws.workspace_enabled,
    status: ws.status,
    startupScript: ws.startup_script,
  };
}

function mergeWorkspaceUiState(
  apiWorkspaces: ApiWorkspace[],
  currentWorkspaces: Workspace[],
): Workspace[] {
  const currentById = new Map(
    currentWorkspaces.map((workspace) => [workspace.id, workspace]),
  );

  return apiWorkspaces.map((workspace, index) => {
    const mapped = mapApiWorkspace(workspace, index);
    const current = currentById.get(mapped.id);
    if (!current) {
      return mapped;
    }

    return {
      ...mapped,
      runningSessions: current.runningSessions,
      hasNotifications: current.hasNotifications,
    };
  });
}

interface WorkspaceState {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  lastSessionByWorkspace: Record<string, string>;
  sessionWorkspaceById: Record<string, string>;
  loading: boolean;
  error: string | null;

  fetchWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string) => void;
  setLastSession: (workspaceId: string, sessionId: string) => void;
  getLastSession: (workspaceId: string) => string | null;
  clearLastSession: (workspaceId: string) => void;
  addWorkspace: (workspace: { title: string; path: string; color?: string; startupScript?: string; worktreeEnabled?: boolean }) => Promise<void>;
  removeWorkspace: (id: string) => Promise<void>;
  registerSessionWorkspace: (sessionId: string, workspaceId: string) => void;
  registerWorkspaceSessions: (
    workspaceId: string,
    sessionIds: string[],
  ) => void;
  getWorkspaceForSession: (sessionId: string) => string | null;
  markWorkspaceNotification: (workspaceId: string) => void;
  clearWorkspaceNotification: (workspaceId: string) => void;
}

let _restoredId: string | null = null;
let _restoredLastSessionMap: Record<string, string> = {};
const _restorePromise = Promise.all([
  readSelectedId().then((id) => { _restoredId = id; }),
  readLastSessionMap().then((map) => { _restoredLastSessionMap = map; }),
]);

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  selectedWorkspaceId: null,
  lastSessionByWorkspace: {},
  sessionWorkspaceById: {},
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    await _restorePromise;
    set({ loading: true, error: null, lastSessionByWorkspace: _restoredLastSessionMap });
    const result = await list();
    if (result.error) {
      set({ loading: false, error: 'Failed to fetch workspaces' });
      return;
    }
    const rawWorkspaces = unwrapApiData(result.data) ?? [];
    const workspaces = mergeWorkspaceUiState(rawWorkspaces, get().workspaces);
    const currentSelected = get().selectedWorkspaceId ?? _restoredId;
    const selectedWorkspaceId =
      workspaces.find((w) => w.id === currentSelected)?.id ?? workspaces[0]?.id ?? null;
    set({ workspaces, selectedWorkspaceId, loading: false });
    writeSelectedId(selectedWorkspaceId);
  },

  selectWorkspace: (id) => {
    set({ selectedWorkspaceId: id });
    writeSelectedId(id);
  },

  setLastSession: (workspaceId, sessionId) => {
    const updated = { ...get().lastSessionByWorkspace, [workspaceId]: sessionId };
    set({ lastSessionByWorkspace: updated });
    writeLastSessionMap(updated);
  },

  getLastSession: (workspaceId) => {
    return get().lastSessionByWorkspace[workspaceId] ?? null;
  },

  clearLastSession: (workspaceId) => {
    const { [workspaceId]: _, ...rest } = get().lastSessionByWorkspace;
    set({ lastSessionByWorkspace: rest });
    writeLastSessionMap(rest);
  },

  addWorkspace: async (workspace) => {
    const result = await apiCreate({
      body: {
        name: workspace.title,
        path: workspace.path,
        color: workspace.color,
        startup_script: workspace.startupScript,
        workspace_enabled: workspace.worktreeEnabled,
      },
    });
    const rawWorkspace = unwrapApiData(result.data);
    if (rawWorkspace) {
      const ws = mapApiWorkspace(rawWorkspace, get().workspaces.length);
      set((state) => ({
        workspaces: [...state.workspaces, ws],
        selectedWorkspaceId: ws.id,
      }));
      writeSelectedId(ws.id);
    }
  },

  removeWorkspace: async (id) => {
    const result = await apiDelete({ path: { id } });
    if (!result.error) {
      set((state) => {
        const filtered = state.workspaces.filter((w) => w.id !== id);
        const sessionWorkspaceById = Object.fromEntries(
          Object.entries(state.sessionWorkspaceById).filter(
            ([, workspaceId]) => workspaceId !== id,
          ),
        );
        const selectedId =
          state.selectedWorkspaceId === id
            ? (filtered[0]?.id ?? null)
            : state.selectedWorkspaceId;
        writeSelectedId(selectedId);
        return {
          workspaces: filtered,
          selectedWorkspaceId: selectedId,
          sessionWorkspaceById,
        };
      });
    }
  },

  registerSessionWorkspace: (sessionId, workspaceId) =>
    set((state) => {
      if (state.sessionWorkspaceById[sessionId] === workspaceId) {
        return state;
      }

      return {
        sessionWorkspaceById: {
          ...state.sessionWorkspaceById,
          [sessionId]: workspaceId,
        },
      };
    }),

  registerWorkspaceSessions: (workspaceId, sessionIds) =>
    set((state) => {
      let changed = false;
      const next = { ...state.sessionWorkspaceById };

      for (const sessionId of sessionIds) {
        if (next[sessionId] === workspaceId) continue;
        next[sessionId] = workspaceId;
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return { sessionWorkspaceById: next };
    }),

  getWorkspaceForSession: (sessionId) => {
    return get().sessionWorkspaceById[sessionId] ?? null;
  },

  markWorkspaceNotification: (workspaceId) =>
    set((state) => {
      let changed = false;
      const workspaces = state.workspaces.map((workspace) => {
        if (
          workspace.id !== workspaceId ||
          workspace.hasNotifications
        ) {
          return workspace;
        }

        changed = true;
        return { ...workspace, hasNotifications: true };
      });

      return changed ? { workspaces } : state;
    }),

  clearWorkspaceNotification: (workspaceId) =>
    set((state) => {
      let changed = false;
      const workspaces = state.workspaces.map((workspace) => {
        if (
          workspace.id !== workspaceId ||
          !workspace.hasNotifications
        ) {
          return workspace;
        }

        changed = true;
        return { ...workspace, hasNotifications: false };
      });

      return changed ? { workspaces } : state;
    }),
}));
