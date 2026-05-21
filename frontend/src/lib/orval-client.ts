export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const getEnvVar = (key: string): string => {
  // Check runtime variables injected by Express first
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key];
  }

  return import.meta.env[key] || '';
};

export function resolveBaseUrl() {
  if (typeof window !== 'undefined') {
    return getEnvVar('VITE_PUBLIC_API_URL') || 'http://127.0.0.1:8000';
  }

  return (
    process.env.INTERNAL_API_URL ??
    process.env.VITE_PUBLIC_API_URL ??
    process.env.OPENAPI_URL?.replace(/\/openapi\.json$/, '') ??
    'http://127.0.0.1:8000'
  );
}

export async function customInstance<T>(url: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('seneschal.auth.token') : null;
  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(new URL(url, resolveBaseUrl()), {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload =
    response.status === 204
      ? undefined
      : contentType.includes('application/json')
        ? ((await response.json()) as unknown)
        : ((await response.text()) as unknown);

  if (!response.ok) {
    const detail =
      typeof payload === 'object' &&
      payload !== null &&
      'detail' in payload &&
      typeof payload.detail === 'string'
        ? payload.detail
        : `Request failed with status ${response.status}`;

    if (response.status === 401 && !url.includes('/api/auth/login')) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('seneschal.auth.token');
        if (window.location.pathname !== '/auth') {
          window.location.replace('/auth');
        }
      }
    }

    throw new ApiError(detail, response.status, payload);
  }

  return {
    data: payload,
    headers: response.headers,
    status: response.status,
  } as T;
}
