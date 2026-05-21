import {
  loginApiAuthLoginPost,
  logoutApiAuthLogoutPost,
  getProfileApiAuthMeGet,
  getUsersApiUsersGet,
} from '@/api/endpoints/api';
import type { AdminProfileResponse, UserResponse } from '@/api/models';
import { ApiError } from '@/lib/orval-client';

export { ApiError };
export type { AdminProfileResponse, UserResponse };

export type LoginResponse = {
  token: string;
};

const TOKEN_KEY = 'seneschal.auth.token';

function authHeader(token: string): RequestInit {
  return { headers: { Authorization: `Bearer ${token}` } };
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
  const res = await loginApiAuthLoginPost({ username, password });
  if (res.status !== 200) throw new Error('Login failed');
  return res.data as LoginResponse;
}

export async function logout(token: string): Promise<void> {
  await logoutApiAuthLogoutPost(authHeader(token));
}

export async function getProfile(token: string): Promise<AdminProfileResponse> {
  const res = await getProfileApiAuthMeGet(authHeader(token));
  if (res.status !== 200) throw new Error('Failed to get profile');
  return res.data as AdminProfileResponse;
}

export async function listUsers(token: string): Promise<UserResponse[]> {
  const res = await getUsersApiUsersGet(authHeader(token));
  if (res.status !== 200) throw new Error('Failed to list users');
  return res.data as UserResponse[];
}
