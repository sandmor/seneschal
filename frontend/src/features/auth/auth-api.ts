// 🔥 MOCK API — Auth

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
};

export type AdminProfileResponse = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

export type UserResponse = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

const TOKEN_KEY = 'seneschal.auth.token';

const mockUsers: UserResponse[] = [
  { id: 'user_1', username: 'santiago', email: 'santiago@example.com', isAdmin: true },
  { id: 'user_2', username: 'ana', email: 'ana@example.com', isAdmin: false },
  { id: 'user_3', username: 'carlos', email: 'carlos@example.com', isAdmin: false },
];

const mockProfiles: Record<string, AdminProfileResponse> = {
  'mock-token-santiago': {
    id: 'user_1',
    username: 'santiago',
    email: 'santiago@example.com',
    isAdmin: true,
  },
  'mock-token-ana': { id: 'user_2', username: 'ana', email: 'ana@example.com', isAdmin: false },
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

export async function login(username: string, password: string): Promise<LoginResponse> {
  void password;
  const user = mockUsers.find((u) => u.username === username);
  if (!user) throw new Error('Invalid username or password');
  const accessToken = `mock-token-${username}`;
  return { accessToken, tokenType: 'bearer' };
}

export async function logout(token: string): Promise<void> {
  void token;
}

export async function getProfile(token: string): Promise<AdminProfileResponse> {
  const profile = mockProfiles[token];
  if (!profile) throw new Error('Invalid token');
  return profile;
}

export async function listUsers(token: string): Promise<UserResponse[]> {
  void token;
  return mockUsers;
}
