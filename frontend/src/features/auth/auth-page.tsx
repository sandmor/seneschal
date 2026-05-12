import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { AdminProfileResponse } from '@/features/auth/auth-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  getProfile,
  getStoredAuthToken,
  listUsers,
  login,
  logout,
  storeAuthToken,
} from '@/features/auth/auth-api';
import { getApiErrorMessage } from '@/lib/api-errors';
import { ApiError } from '@/lib/orval-client';

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setToken(getStoredAuthToken());
    setIsHydrated(true);
  }, []);

  const profileQuery = useQuery({
    queryKey: ['auth', 'profile', token],
    queryFn: () => getProfile(token!),
    enabled: isHydrated && Boolean(token),
    retry: false,
  });

  const usersQuery = useQuery({
    queryKey: ['auth', 'users', token],
    queryFn: () => listUsers(token!),
    enabled: isHydrated && Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (!isUnauthorized(profileQuery.error)) return;
    storeAuthToken(null);
    setToken(null);
    setNotice('Your session expired. Sign in again.');
    void queryClient.removeQueries({ queryKey: ['auth'] });
  }, [profileQuery.error, queryClient]);

  const loginMutation = useMutation({
    mutationFn: ({ nextUsername, nextPassword }: { nextUsername: string; nextPassword: string }) =>
      login(nextUsername, nextPassword),
    onSuccess: ({ token: nextToken }) => {
      storeAuthToken(nextToken);
      setToken(nextToken);
      setPassword('');
      setNotice('Signed in.');
      void navigate({ to: '/', search: { path: '/', document: undefined } });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await logout(token);
    },
    onSettled: () => {
      storeAuthToken(null);
      setToken(null);
      setNotice('Signed out.');
      void queryClient.removeQueries({ queryKey: ['auth'] });
    },
  });

  const isBusy =
    loginMutation.isPending ||
    logoutMutation.isPending ||
    profileQuery.isLoading ||
    usersQuery.isLoading;

  const profile = profileQuery.data ?? null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice(null);
    try {
      await loginMutation.mutateAsync({ nextUsername: username, nextPassword: password });
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    }
  };

  const handleSignOut = async () => {
    setNotice(null);
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    }
  };

  if (profile) {
    return (
      <SessionView
        profile={profile}
        users={usersQuery.data ?? []}
        usersError={usersQuery.error}
        notice={notice}
        isBusy={isBusy}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <LoginView
      username={username}
      password={password}
      notice={notice ?? (profileQuery.error ? getApiErrorMessage(profileQuery.error) : null)}
      isBusy={isBusy}
      isHydrated={isHydrated}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  );
}

// ─── Login View ───────────────────────────────────────────────────────────────

function LoginView({
  username,
  password,
  notice,
  isBusy,
  isHydrated,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  username: string;
  password: string;
  notice: string | null;
  isBusy: boolean;
  isHydrated: boolean;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
      {/* Left decorative panel */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-foreground p-12 lg:flex">
        {/* Geometric background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 40px,
                oklch(0.9 0.01 75) 40px,
                oklch(0.9 0.01 75) 41px
              ), repeating-linear-gradient(
                90deg,
                transparent,
                transparent 40px,
                oklch(0.9 0.01 75) 40px,
                oklch(0.9 0.01 75) 41px
              )`,
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ShieldIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-semibold text-background">Seneschal</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
              Document Management
            </p>
            <h2 className="font-heading text-4xl font-semibold leading-tight text-background">
              Your archive,
              <br />
              <span className="text-primary">secured.</span>
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-background/50">
            Role-based access control for your documents. Sign in to access your workspace.
          </p>

          {/* Feature list */}
          <div className="space-y-3 pt-4">
            {['Role-based permissions', 'Document version control', 'Real-time collaboration'].map(
              (feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <CheckIcon className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm text-background/60">{feature}</span>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs text-background/30">© 2026 Seneschal. All rights reserved.</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <ShieldIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-semibold text-foreground">Seneschal</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold text-foreground">Welcome back</h1>
            <p className="sr-only">Authentication</p>
            <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="username">
                Username
              </label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="Enter your username"
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-10"
              />
            </div>

            {notice && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {notice}
              </div>
            )}

            <Button type="submit" size="lg" disabled={!isHydrated || isBusy} className="w-full">
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Hint */}
          <p className="text-center text-xs text-muted-foreground">
            Access is managed by your administrator.
            <br />
            Contact them if you need credentials.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Session View ─────────────────────────────────────────────────────────────

function SessionView({
  profile,
  users,
  usersError,
  notice,
  isBusy,
  onSignOut,
}: {
  profile: AdminProfileResponse;
  users: Array<{ id: number; name: string; roles: string[] }>;
  usersError: unknown;
  notice: string | null;
  isBusy: boolean;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ShieldIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-lg font-semibold text-foreground">Seneschal</span>
          </div>
          <Button variant="outline" size="sm" onClick={onSignOut} disabled={isBusy}>
            {isBusy ? 'Working…' : 'Sign out'}
          </Button>
        </div>

        {/* Profile card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {profile.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <h2 className="mt-0.5 text-xl font-semibold text-foreground">{profile.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{profile.email}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{profile.role}</Badge>
                {profile.roles
                  .filter((r) => r !== profile.role)
                  .map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {notice && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            {notice}
          </div>
        )}

        {/* Users list */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Users
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Available accounts</h3>
            </div>
            <Badge variant="secondary">{users.length} loaded</Badge>
          </div>

          {usersError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(usersError)}</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">User #{user.id}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={`${user.id}-${role}`} variant="outline" className="text-[10px]">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
