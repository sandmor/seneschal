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

export class CollaborationInitError extends Error {
  constructor(message = 'Collaboration room failed to initialize.') {
    super(message);
    this.name = 'CollaborationInitError';
  }
}

export type YjsProviderOptions = {
  collaborationId: string;
  token?: string;
  initialContent: string;
  /** When true, the caller may POST initialize with a client-built seed (writers only). */
  canInitialize: boolean;
  /** When set, used to build seeds on recovery instead of stale initialContent. */
  getSeedContent?: () => Promise<string>;
};

export type YjsProviderResult = {
  ydoc: Y.Doc | undefined;
  provider: WebsocketProvider | undefined;
  /** False when read-only and the room has not been initialized yet. */
  collaborationActive: boolean;
};

type RequestAuthOptions = Parameters<
  typeof checkRoomStatusEndpointApiRoomsCollaborationIdStatusGet
>[1];

function buildAuthOptions(token?: string): RequestAuthOptions | undefined {
  if (!token) return undefined;
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function createYjsProvider({
  collaborationId,
  token,
  initialContent,
  canInitialize,
  getSeedContent,
}: YjsProviderOptions): Promise<YjsProviderResult> {
  const authOptions = buildAuthOptions(token);
  const resolveSeedContent = getSeedContent ?? (async () => initialContent);

  const roomExists = await isRoomInitialized(collaborationId, authOptions);

  if (!roomExists) {
    if (!canInitialize) {
      return { ydoc: undefined, provider: undefined, collaborationActive: false };
    }

    await ensureRoomInitialized(collaborationId, resolveSeedContent, authOptions);
  }

  if (!(await isRoomInitialized(collaborationId, authOptions))) {
    throw new CollaborationInitError();
  }

  const ydoc = new Y.Doc();
  const wsBaseUrl = resolveBaseUrl().replace(/^http/, 'ws');
  const wsUrl = `${wsBaseUrl}/api/documents/yjs`;

  const provider = new WebsocketProvider(wsUrl, collaborationId, ydoc, {
    params: token ? { token } : {},
    protocols: ['y-websocket'],
    connect: true,
    resyncInterval: 10000,
    maxBackoffTime: 10000,
  });

  if (canInitialize) {
    setupRoomRecovery(provider, collaborationId, resolveSeedContent, token);
  }

  provider.awareness.setLocalStateField('user', createPresenceUser(token));
  bindPresenceCleanup(provider);

  return { ydoc, provider, collaborationActive: true };
}

async function isRoomInitialized(
  collaborationId: string,
  authOptions: RequestAuthOptions | undefined,
): Promise<boolean> {
  const statusResponse = await checkRoomStatusEndpointApiRoomsCollaborationIdStatusGet(
    collaborationId,
    authOptions,
  );
  return (
    'data' in statusResponse &&
    statusResponse.data !== undefined &&
    (statusResponse.data as { initialized?: boolean }).initialized === true
  );
}

async function ensureRoomInitialized(
  collaborationId: string,
  resolveSeedContent: () => Promise<string>,
  authOptions: RequestAuthOptions | undefined,
): Promise<void> {
  if (await isRoomInitialized(collaborationId, authOptions)) {
    return;
  }

  const lockKey = `${TAB_LOCK_PREFIX}${collaborationId}`;
  const acquired = await acquireTabLock(lockKey, TAB_LOCK_TIMEOUT_MS);

  if (acquired) {
    try {
      if (!(await isRoomInitialized(collaborationId, authOptions))) {
        const content = await resolveSeedContent();
        await postRoomInitialize(collaborationId, content, authOptions);
      }
    } finally {
      releaseTabLock(lockKey);
    }
    return;
  }

  await waitForTabLock(lockKey, TAB_LOCK_TIMEOUT_MS);
  if (await isRoomInitialized(collaborationId, authOptions)) {
    return;
  }

  const retryAcquired = await acquireTabLock(lockKey, TAB_LOCK_TIMEOUT_MS);
  if (!retryAcquired) {
    await waitForTabLock(lockKey, TAB_LOCK_TIMEOUT_MS);
    if (await isRoomInitialized(collaborationId, authOptions)) {
      return;
    }
    throw new CollaborationInitError();
  }

  try {
    if (!(await isRoomInitialized(collaborationId, authOptions))) {
      const content = await resolveSeedContent();
      await postRoomInitialize(collaborationId, content, authOptions);
    }
  } finally {
    releaseTabLock(lockKey);
  }
}

async function postRoomInitialize(
  collaborationId: string,
  initialContent: string,
  authOptions: RequestAuthOptions | undefined,
): Promise<void> {
  const seed = createSeed(initialContent);
  const base64Seed = arrayBufferToBase64(seed);
  const requestBody: InitializeRoomRequest = { seed: base64Seed };
  await initializeRoomEndpointApiRoomsCollaborationIdInitializePost(
    collaborationId,
    requestBody,
    authOptions,
  );
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
  resolveSeedContent: () => Promise<string>,
  token?: string,
) {
  let recovering = false;

  const onClose = (event: CloseEvent | null, provider: WebsocketProvider) => {
    if (!event || recovering) return;
    if (event.code === SEED_REQUIRE_CLOSE_CODE) {
      recovering = true;
      provider.disconnect();

      void (async () => {
        try {
          const content = await resolveSeedContent();
          await postRoomInitialize(collaborationId, content, buildAuthOptions(token));
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
      return false;
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

  const destroy = provider.destroy.bind(provider);
  provider.destroy = () => {
    window.removeEventListener('pagehide', clearPresence);
    provider.awareness.setLocalState(null);
    destroy();
  };
}
