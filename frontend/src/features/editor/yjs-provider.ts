import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const PRESENCE_ID_KEY = 'seneschal.collaboration.presenceId';
const PRESENCE_TAB_ID_KEY = 'seneschal.collaboration.tabId';
const PRESENCE_PALETTE = ['#2d7a7a', '#b7791f', '#8a4f3d', '#4f6f52', '#5f5a8b', '#9a4f63'];

export type YjsProviderOptions = {
  documentPath: string;
  token?: string;
  apiUrl: string;
};

export function createYjsProvider({ documentPath, token, apiUrl }: YjsProviderOptions): {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
} {
  const ydoc = new Y.Doc();

  // Convert http(s) API URL to ws(s) WebSocket URL
  const wsBaseUrl = apiUrl.replace(/^http/, 'ws');
  const roomName = documentPath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');

  const provider = new WebsocketProvider(`${wsBaseUrl}/ws/documents`, roomName, ydoc, {
    params: token ? { token } : {},
    protocols: ['y-websocket'],
    connect: true,
    resyncInterval: 10000,
    maxBackoffTime: 10000,
  });

  provider.awareness.setLocalStateField('user', createPresenceUser(token));
  bindPresenceCleanup(provider);

  return { ydoc, provider };
}

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
