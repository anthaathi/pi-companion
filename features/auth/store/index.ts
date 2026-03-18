import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { client } from '@/features/api/generated/client.gen';
import { login as apiLogin, logout as apiLogout, checkSession, pair as apiPair } from '@/features/api/generated/sdk.gen';
import { unwrapApiData } from '@/features/api/unwrap';
import type { Server } from '@/features/servers/store';

const TOKENS_KEY = 'auth_tokens';
const ACTIVE_SERVER_KEY = 'auth_active_server';
const DEBUG_ROUTES = ['/api/auth/pair', '/api/auth/session', '/api/workspaces'];

interface AuthState {
  /** serverId → token */
  tokens: Record<string, string>;
  activeServerId: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  /** Login to a server with credentials, stores the token keyed by server id */
  loginToServer: (server: Server) => Promise<{ success: boolean; error?: string }>;
  /** Pair with a server via QR code. Calls POST /api/auth/pair, waits for operator to accept. */
  pairWithServer: (baseUrl: string, qrId: string, serverId: string) => Promise<{ success: boolean; error?: string }>;
  /** Logout from a specific server (removes its token) */
  logoutFromServer: (serverId: string) => Promise<void>;
  /** Switch the active server, verify session, configure the API client. Returns false if session is invalid. */
  activateServer: (server: Server) => Promise<boolean>;
  /** Check if a server has a stored token */
  hasToken: (serverId: string) => boolean;
}

async function readStore(): Promise<{ tokens: Record<string, string>; activeServerId: string | null }> {
  try {
    if (Platform.OS === 'web') {
      const rawTokens = localStorage.getItem(TOKENS_KEY);
      const activeServerId = localStorage.getItem(ACTIVE_SERVER_KEY);
      return {
        tokens: rawTokens ? JSON.parse(rawTokens) : {},
        activeServerId,
      };
    }
    const rawTokens = await SecureStore.getItemAsync(TOKENS_KEY);
    const activeServerId = await SecureStore.getItemAsync(ACTIVE_SERVER_KEY);
    return {
      tokens: rawTokens ? JSON.parse(rawTokens) : {},
      activeServerId,
    };
  } catch {
    return { tokens: {}, activeServerId: null };
  }
}

async function writeTokens(tokens: Record<string, string>) {
  try {
    const json = JSON.stringify(tokens);
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKENS_KEY, json);
    } else {
      await SecureStore.setItemAsync(TOKENS_KEY, json);
    }
  } catch {}
}

async function writeActiveServerId(serverId: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (serverId) localStorage.setItem(ACTIVE_SERVER_KEY, serverId);
      else localStorage.removeItem(ACTIVE_SERVER_KEY);
    } else {
      if (serverId) await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, serverId);
      else await SecureStore.deleteItemAsync(ACTIVE_SERVER_KEY);
    }
  } catch {}
}

function formatTokenDebug(token: string | null | undefined) {
  if (!token) return 'none';
  return `${token.slice(0, 8)}... len=${token.length}`;
}

client.setConfig({
  requestValidator: async (value) => {
    const request = value as {
      method?: string;
      url?: string;
      baseUrl?: string;
      auth?: unknown;
      headers?: Headers;
    };
    const fullUrl = `${request.baseUrl ?? ''}${request.url ?? ''}`;
    if (!DEBUG_ROUTES.some((route) => fullUrl.includes(route))) {
      return;
    }

    const authHeader = request.headers?.get('Authorization');
    const authConfig =
      typeof request.auth === 'string'
        ? formatTokenDebug(request.auth.replace(/^Bearer\s+/i, ''))
        : request.auth
          ? '[auth-callback]'
          : 'none';

    console.log(
      `[req] ${request.method ?? 'GET'} ${fullUrl} authHeader=${formatTokenDebug(
        authHeader?.replace(/^Bearer\s+/i, ''),
      )} configAuth=${authConfig}`,
    );
  },
});

function setClientAuthToken(token: string | null) {
  console.log(`[auth] setClientAuthToken token=${formatTokenDebug(token)}`);
  client.setConfig({ auth: token ?? undefined });
}

function configureClient(baseUrl: string, token: string) {
  console.log(
    `[auth] configureClient baseUrl=${baseUrl} token=${formatTokenDebug(token)}`,
  );
  setClientAuthToken(token);
  client.setConfig({ baseUrl });
}

function clearClientAuth() {
  setClientAuthToken(null);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  tokens: {},
  activeServerId: null,
  loaded: false,

  load: async () => {
    const { tokens, activeServerId } = await readStore();
    set({ tokens, activeServerId, loaded: true });
  },

  loginToServer: async (server: Server) => {
    const result = await apiLogin({
      baseUrl: server.address,
      body: {
        username: server.username,
        password: server.password,
      },
    });

    if (result.error) {
      return {
        success: false,
        error: (result.error as { error?: string })?.error ?? 'Login failed',
      };
    }

    const token = unwrapApiData(result.data)?.token;
    console.log(`[loginToServer] response token=${formatTokenDebug(token)}`);
    if (!token) {
      return { success: false, error: 'Login token missing from response' };
    }
    const tokens = { ...get().tokens, [server.id]: token };

    configureClient(server.address, token);
    set({ tokens, activeServerId: server.id });

    await writeTokens(tokens);
    await writeActiveServerId(server.id);

    return { success: true };
  },

  pairWithServer: async (baseUrl: string, qrId: string, serverId: string) => {
    const result = await apiPair({
      baseUrl,
      body: { qr_id: qrId },
    });

    if (result.error) {
      const err = result.error as { error?: string };
      return {
        success: false,
        error: err?.error ?? 'Pairing failed',
      };
    }

    const token = unwrapApiData(result.data)?.token;
    console.log(`[pairWithServer] response token=${formatTokenDebug(token)}`);
    if (!token) {
      return { success: false, error: 'Pairing token missing from response' };
    }
    const tokens = { ...get().tokens, [serverId]: token };

    configureClient(baseUrl, token);
    set({ tokens, activeServerId: serverId });

    await writeTokens(tokens);
    await writeActiveServerId(serverId);

    return { success: true };
  },

  logoutFromServer: async (serverId: string) => {
    // Call logout API to invalidate the token on the server
    const token = get().tokens[serverId];
    if (token) {
      // Temporarily set the token so the logout request is authenticated
      const prevAuth = client.getConfig().auth;
      setClientAuthToken(token);
      try {
        await apiLogout();
      } catch {
        // Best-effort — still clear locally even if API call fails
      }
      client.setConfig({ auth: prevAuth });
    }

    const { [serverId]: _, ...rest } = get().tokens;
    const newActiveId = get().activeServerId === serverId ? null : get().activeServerId;

    set({ tokens: rest, activeServerId: newActiveId });
    await writeTokens(rest);
    await writeActiveServerId(newActiveId);

    if (newActiveId === null) {
      clearClientAuth();
    }
  },

  activateServer: async (server: Server) => {
    const token = get().tokens[server.id];
    if (!token) return false;

    configureClient(server.address, token);

    // Verify the session is still valid
    const result = await checkSession();
    if (result.error) {
      const { [server.id]: _, ...rest } = get().tokens;
      set({ tokens: rest });
      await writeTokens(rest);
      clearClientAuth();
      return false;
    }

    set({ activeServerId: server.id });
    writeActiveServerId(server.id);
    return true;
  },

  hasToken: (serverId: string) => {
    return !!get().tokens[serverId];
  },
}));
