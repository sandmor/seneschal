import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';
import { parseMarkdown } from './markdown-serializer';
import {
  checkRoomStatusEndpointApiRoomsCollaborationIdStatusGet,
  initializeRoomEndpointApiRoomsCollaborationIdInitializePost,
} from '@/api/endpoints/api';
import type { InitializeRoomRequest } from '@/api/models';
import { resolveBaseUrl } from '@/lib/orval-client';

const PRESENCE_ID_KEY = 'seneschal.collaboration.presenceId';
const PRESENCE_TAB_ID_KEY = 'seneschal.collaboration.tabId';
const PRESENCE_PALETTE = ['#2d7a7a', '#b7791f', '#8a4f3d', '#4f6f52', '#5f5a8b', '#9a4f63'];

const SEED_REQUIRE_CLOSE_CODE = 4001;
const TAB_LOCK_PREFIX = 'seneschal.collaboration.lock.';
const TAB_LOCK_TIMEOUT_MS = 10_000;

export type YjsProviderOptions = {
  collaborationId: string;
  token?: string;
  initialContent: string;
};

export type YjsProviderResult = {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
};

export async function createYjsProvider({
  collaborationId,
  token,
  initialContent,
}: YjsProviderOptions): Promise<YjsProviderResult> {
  const ydoc = new Y.Doc();

  // Convert http(s) API URL to ws(s) WebSocket URL
  const wsBaseUrl = resolveBaseUrl().replace(/^http/, 'ws');
  const wsUrl = `${wsBaseUrl}/api/documents/yjs`;

  // Check room status using the generated orval client.
  const statusResponse = await checkRoomStatusEndpointApiRoomsCollaborationIdStatusGet(
    collaborationId,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  const roomExists =
    'data' in statusResponse &&
    statusResponse.data !== undefined &&
    (statusResponse.data as { initialized?: boolean }).initialized === true;

  if (!roomExists) {
    // Coordinate across tabs so only one tab initializes the room.
    const lockKey = `${TAB_LOCK_PREFIX}${collaborationId}`;
    const acquired = await acquireTabLock(lockKey, TAB_LOCK_TIMEOUT_MS);

    if (acquired) {
      try {
        // Double-check status after acquiring the lock (another tab may have initialized).
        const secondCheck = await checkRoomStatusEndpointApiRoomsCollaborationIdStatusGet(
          collaborationId,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );
        const stillNotInitialized =
          'data' in secondCheck &&
          secondCheck.data !== undefined &&
          (secondCheck.data as { initialized?: boolean }).initialized !== true;

        if (stillNotInitialized) {
          const seed = createSeed(initialContent);
          const base64Seed = arrayBufferToBase64(seed);
          const requestBody: InitializeRoomRequest = { seed: base64Seed };
          await initializeRoomEndpointApiRoomsCollaborationIdInitializePost(
            collaborationId,
            requestBody,
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
          );
        }
      } finally {
        releaseTabLock(lockKey);
      }
    } else {
      // Another tab is initializing; wait briefly and then proceed.
      await waitForTabLock(lockKey, TAB_LOCK_TIMEOUT_MS);
    }
  }

  // Create the y-websocket provider and connect.
  // At this point the room is guaranteed to exist on the server.
  const provider = new WebsocketProvider(wsUrl, collaborationId, ydoc, {
    params: token ? { token } : {},
    protocols: ['y-websocket'],
    connect: true,
    resyncInterval: 10000,
    maxBackoffTime: 10000,
  });

  // Handle server-side room loss (e.g. server restart) by re-initializing and reconnecting.
  setupRoomRecovery(provider, collaborationId, initialContent, token);

  provider.awareness.setLocalStateField('user', createPresenceUser(token));
  bindPresenceCleanup(provider);

  return { ydoc, provider };
}

// ---------------------------------------------------------------------------
// Seed generation
// ---------------------------------------------------------------------------

/**
 * Generate a Yjs update seed from markdown content.
 * The seed is used to initialize a fresh collaboration room on the server.
 */
function createSeed(initialContent: string): Uint8Array {
  const tempDoc = new Y.Doc();
  const yXmlFragment = tempDoc.get('prosemirror', Y.XmlFragment);

  if (initialContent) {
    const pmDoc = parseMarkdown(initialContent);
    if (pmDoc) {
      prosemirrorToYXmlFragment(pmDoc, yXmlFragment);
    }
  }

  const seed = Y.encodeStateAsUpdate(tempDoc);
  tempDoc.destroy();
  return seed;
}

// ---------------------------------------------------------------------------
// Room recovery — re-initialize when server drops the room (e.g. restart)
// ---------------------------------------------------------------------------

function setupRoomRecovery(
  provider: WebsocketProvider,
  collaborationId: string,
  initialContent: string,
  token?: string,
) {
  let recovering = false;

  const onClose = (event: CloseEvent | null, provider: WebsocketProvider) => {
    if (!event || recovering) return;
    if (event.code === SEED_REQUIRE_CLOSE_CODE) {
      recovering = true;
      provider.disconnect();

      // Re-run the initialization flow and then reconnect.
      void (async () => {
        try {
          const seed = createSeed(initialContent);
          const base64Seed = arrayBufferToBase64(seed);
          const requestBody: InitializeRoomRequest = { seed: base64Seed };
          await initializeRoomEndpointApiRoomsCollaborationIdInitializePost(
            collaborationId,
            requestBody,
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
          );
        } catch (error) {
          console.error('Failed to re-initialize room after server restart:', error);
        } finally {
          recovering = false;
          provider.connect();
        }
      })();
    }
  };

  provider.on('connection-close', onClose);

  const originalDestroy = provider.destroy.bind(provider);
  provider.destroy = () => {
    provider.off('connection-close', onClose);
    originalDestroy();
  };
}

// ---------------------------------------------------------------------------
// Tab coordination helpers
// ---------------------------------------------------------------------------

function acquireTabLock(key: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      // Fallback: use localStorage timestamp-based lock
      resolve(acquireLocalStorageLock(key, timeoutMs));
      return;
    }

    const channel = new BroadcastChannel(key);
    const myId = `${Date.now()}-${Math.random()}`;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        channel.close();
        resolve(false);
      }
    }, 500);

    channel.onmessage = (event) => {
      if (event.data?.type === 'lock-acquired' && event.data.id !== myId) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          channel.close();
          resolve(false);
        }
      }
    };

    // Attempt to acquire lock via localStorage first
    if (acquireLocalStorageLock(key, timeoutMs)) {
      channel.postMessage({ type: 'lock-acquired', id: myId });
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        channel.close();
        resolve(true);
      }
    } else {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        channel.close();
        resolve(false);
      }
    }
  });
}

function releaseTabLock(key: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(key);
  }
}

function waitForTabLock(key: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        resolve();
        return;
      }
      const timestamp = parseInt(raw, 10);
      if (Date.now() - timestamp > timeoutMs) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

function acquireLocalStorageLock(key: string, timeoutMs: number): boolean {
  if (typeof window === 'undefined') return true;

  const now = Date.now();
  const raw = window.localStorage.getItem(key);

  if (raw) {
    const timestamp = parseInt(raw, 10);
    if (!Number.isNaN(timestamp) && now - timestamp < timeoutMs) {
      return false; // Lock is held by another tab
    }
  }

  window.localStorage.setItem(key, String(now));
  return true;
}

// ---------------------------------------------------------------------------
// Base64 helpers
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Presence helpers
// ---------------------------------------------------------------------------

function createPresenceUser(token?: string) {
  const presenceId = getPresenceId();
  const tabId = getPresenceTabId();
  const name = getPresenceName(token, presenceId);
  const color = PRESENCE_PALETTE[hashString(token ?? presenceId) % PRESENCE_PALETTE.length];

  return { name, color, presenceId, tabId };
}

function getPresenceName(token: string | undefined, fallbackId: string) {
  const username = token?.startsWith('mock-token-') ? token.replace('mock-token-', '') : '';
  if (username) {
    return username
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return `Editor ${fallbackId.slice(-4).toUpperCase()}`;
}

function getPresenceId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingId = window.localStorage.getItem(PRESENCE_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const nextId = window.crypto.randomUUID();
  window.localStorage.setItem(PRESENCE_ID_KEY, nextId);
  return nextId;
}

function getPresenceTabId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingId = window.sessionStorage.getItem(PRESENCE_TAB_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const nextId = window.crypto.randomUUID();
  window.sessionStorage.setItem(PRESENCE_TAB_ID_KEY, nextId);
  return nextId;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function bindPresenceCleanup(provider: WebsocketProvider) {
  if (typeof window === 'undefined') {
    return;
  }

  const clearPresence = (event: Event) => {
    if ('persisted' in event && event.persisted) {
      return;
    }
    provider.awareness.setLocalState(null);
    provider.disconnect();
  };

  window.addEventListener('pagehide', clearPresence);
  window.addEventListener('beforeunload', clearPresence);

  const destroy = provider.destroy.bind(provider);
  provider.destroy = () => {
    window.removeEventListener('pagehide', clearPresence);
    window.removeEventListener('beforeunload', clearPresence);
    provider.awareness.setLocalState(null);
    destroy();
  };
}
