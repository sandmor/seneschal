import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type LoginResponse = {
  token: string;
};

type AdminProfile = {
  id: number;
  name: string;
  role: string;
  roles: string[];
};

const TOKEN_KEY = 'seneschal.superadmin.token';

function useStoredToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
    }
  }, []);

  const updateToken = useCallback((nextToken: string | null) => {
    if (typeof window !== 'undefined') {
      if (nextToken) {
        window.localStorage.setItem(TOKEN_KEY, nextToken);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    }

    setToken(nextToken);
  }, []);

  return [token, updateToken] as const;
}

export const Route = createFileRoute('/')({
  component: home,
});

function home() {
  const [token, setToken] = useStoredToken();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = Boolean(token && profile);

  const loadProfile = async (activeToken: string) => {
    const data = await apiFetch<AdminProfile>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });
    setProfile(data);
  };

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loadProfile(token)
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, setToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      setToken(response.token);
      await loadProfile(response.token);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore logout errors for demo purposes.
    } finally {
      setToken(null);
      setProfile(null);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-6 py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="space-y-2">
          <span className="sr-only">Welcome Home!</span>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
            Seneschal
          </p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Panel de superadmin
          </h1>
          <p className="text-base text-muted-foreground">
            Inicia sesion para entrar al panel. Este acceso es solo para pruebas locales.
          </p>
        </header>

        <div className="grid gap-6 rounded-3xl border border-border bg-white/80 p-8 shadow-lg shadow-emerald-100/40 backdrop-blur">
          {isAuthenticated && profile ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Sesion activa</p>
                  <p className="text-xl font-semibold text-foreground">{profile.name}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleLogout}
                  disabled={isLoading}
                >
                  Cerrar sesion
                </button>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                <p className="text-sm font-semibold text-emerald-700">Acceso concedido</p>
                <p className="mt-1 text-sm text-emerald-700/80">Rol: {profile.role}</p>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="username">
                  Usuario
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-base shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="admin"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Contrasena
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-base shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="admin123"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm font-medium text-red-500">{error}</p> : ''}
              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading ? 'Validando...' : 'Iniciar sesion'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
