// 🔥 MOCK API — Auth (independiente de orval)

// Tipos que imitan lo que el backend real retorna
export type LoginResponse = {
  token: string;
};

export type AdminProfileResponse = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  roles: string[];
  isAdmin: boolean;
};

export type UserResponse = {
  id: number;
  name: string;
  username: string;
  email: string;
  roles: string[];
};

const TOKEN_KEY = 'seneschal.auth.token';

const mockUsers: UserResponse[] = [
  {
    id: 1,
    name: 'Santiago Morales',
    username: 'santiago',
    email: 'santiago@example.com',
    roles: ['Admin'],
  },
  { id: 2, name: 'Ana García', username: 'ana', email: 'ana@example.com', roles: ['Editor'] },
  {
    id: 3,
    name: 'Carlos López',
    username: 'carlos',
    email: 'carlos@example.com',
    roles: ['Viewer'],
  },
];

const mockProfiles: Record<string, AdminProfileResponse> = {
  'mock-token-santiago': {
    id: 'user_1',
    name: 'Santiago Morales',
    username: 'santiago',
    email: 'santiago@example.com',
    role: 'Admin',
    roles: ['Admin'],
    isAdmin: true,
  },
  'mock-token-ana': {
    id: 'user_2',
    name: 'Ana García',
    username: 'ana',
    email: 'ana@example.com',
    role: 'Editor',
    roles: ['Editor'],
    isAdmin: false,
  },
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
  return { token: `mock-token-${username}` };
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
