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

export function resolveBaseUrl() {
  if (typeof window !== 'undefined') {
    return import.meta.env.VITE_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
  }

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
      ...(options?.headers ?? {}),
    },
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

    throw new ApiError(detail, response.status, payload);
  }

  return {
    data: payload,
    headers: response.headers,
    status: response.status,
  } as T;
}
