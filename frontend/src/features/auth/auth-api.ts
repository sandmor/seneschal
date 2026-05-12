import { customInstance, ApiError } from '@/lib/orval-client';

export { ApiError };

export type LoginResponse = {
  token: string;
};

export type AdminProfileResponse = {
  id: number;
  name: string;
  role: string;
  roles: string[];
};

export type UserResponse = {
  id: number;
  name: string;
  roles: string[];
};

const TOKEN_KEY = 'seneschal.auth.token';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

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
  const res = await customInstance<{ data: LoginResponse }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.data;
}

export async function logout(token: string): Promise<void> {
  await customInstance<void>('/api/auth/logout', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function getProfile(token: string): Promise<AdminProfileResponse> {
  const res = await customInstance<{ data: AdminProfileResponse }>('/api/auth/me', {
    headers: authHeaders(token),
  });
  return res.data;
}

export async function listUsers(token: string): Promise<UserResponse[]> {
  const res = await customInstance<{ data: UserResponse[] }>('/api/users', {
    headers: authHeaders(token),
  });
  return res.data;
}
