import {
  getProfileApiAuthMeGet,
  getUsersApiUsersGet,
  loginApiAuthLoginPost,
  logoutApiAuthLogoutPost,
} from '@/api/endpoints/api';
import type { AdminProfileResponse, LoginResponse, UserResponse } from '@/api/models';

const TOKEN_KEY = 'seneschal.auth.token';

function createAuthorizationHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeAuthToken(token: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, password: string) {
  const response = await loginApiAuthLoginPost({ username, password });
  return response.data as LoginResponse;
}

export async function logout(token: string) {
  const response = await logoutApiAuthLogoutPost({
    headers: createAuthorizationHeaders(token),
  });

  return response.data;
}

export async function getProfile(token: string) {
  const response = await getProfileApiAuthMeGet({
    headers: createAuthorizationHeaders(token),
  });

  return response.data as AdminProfileResponse;
}

export async function listUsers(token: string) {
  const response = await getUsersApiUsersGet({
    headers: createAuthorizationHeaders(token),
  });

  return response.data as UserResponse[];
}
