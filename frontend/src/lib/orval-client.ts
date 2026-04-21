function resolveBaseUrl() {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.VITE_PUBLIC_API_URL ??
    process.env.OPENAPI_URL?.replace(/\/openapi\.json$/, '') ??
    'http://127.0.0.1:8000'
  );
}

export async function customInstance<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(new URL(url, resolveBaseUrl()), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
