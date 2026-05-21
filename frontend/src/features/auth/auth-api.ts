import {
  getProfileApiAuthMeGet,
  getUsersApiUsersGet,
  loginApiAuthLoginPost,
  logoutApiAuthLogoutPost,
} from '@/api/endpoints/api';
import type { AdminProfileResponse, UserResponse } from '@/api/models';
import { ApiError } from '@/lib/orval-client';

export { ApiError };
export type { AdminProfileResponse, UserResponse };

export type LoginResponse = {
  token: string;
};

const TOKEN_KEY = 'seneschal.auth.token';

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
  const response = await loginApiAuthLoginPost({ username, password });
  if (response.status !== 200) throw new Error('Login failed');
  return response.data as LoginResponse;
}

export async function logout(): Promise<void> {
  await logoutApiAuthLogoutPost();
}

export async function getProfile(): Promise<AdminProfileResponse> {
  const response = await getProfileApiAuthMeGet();
  if (response.status !== 200) throw new Error('Failed to get profile');
  return response.data as AdminProfileResponse;
}

export async function listUsers(): Promise<UserResponse[]> {
  const response = await getUsersApiUsersGet();
  if (response.status !== 200) throw new Error('Failed to list users');
  return response.data as UserResponse[];
}
