// 🔥 MOCK API — Auth

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export type AdminProfileResponse = {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
};

export type UserResponse = {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
};

const TOKEN_KEY = 'seneschal.auth.token';

// 🧠 Mock users
const mockUsers: UserResponse[] = [
  { id: 'user_1', username: 'santiago', email: 'santiago@example.com', is_admin: true },
  { id: 'user_2', username: 'ana', email: 'ana@example.com', is_admin: false },
  { id: 'user_3', username: 'carlos', email: 'carlos@example.com', is_admin: false },
];

const mockProfiles: Record<string, AdminProfileResponse> = {
  'mock-token-santiago': {
    id: 'user_1',
    username: 'santiago',
    email: 'santiago@example.com',
    is_admin: true,
  },
  'mock-token-ana': { id: 'user_2', username: 'ana', email: 'ana@example.com', is_admin: false },
};

export function getStoredAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, _password: string): Promise<LoginResponse> {
  const user = mockUsers.find((u) => u.username === username);
  if (!user) throw new Error('Invalid username or password');
  const token = `mock-token-${username}`;
  return { access_token: token, token_type: 'bearer' };
}

export async function logout(_token: string): Promise<void> {
  // noop en mock
}

export async function getProfile(token: string): Promise<AdminProfileResponse> {
  const profile = mockProfiles[token];
  if (!profile) throw new Error('Invalid token');
  return profile;
}

export async function listUsers(_token: string): Promise<UserResponse[]> {
  return mockUsers;
}
