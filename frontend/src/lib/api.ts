export function resolvePublicApiBase() {
  return import.meta.env.VITE_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${resolvePublicApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (response.status === 401) {
    localStorage.removeItem('token');
  }

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}
