import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useEffect, useState } from 'react';
import type { AdminProfileResponse } from '@/features/auth/auth-api';
import { AppShell } from '@/components/app-shell';
import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    if (!isUnauthorized(profileQuery.error)) {
      return;
    }

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
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        return;
      }

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

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    try {
      await loginMutation.mutateAsync({
        nextUsername: username,
        nextPassword: password,
      });
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

  return (
    <AppShell sidebar={<Sidebar directoryCount={0} documentCount={0} />}>
      <div className="flex flex-1 flex-col overflow-hidden px-4 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Badge
                variant="outline"
                className="rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em]"
              >
                Authentication
              </Badge>
              <div className="space-y-2">
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Sign in
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Use the configured credentials to test the authentication flow.
                </p>
              </div>
            </div>
          </header>

          <main className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              {profile ? (
                <SessionPanel
                  isBusy={isBusy}
                  notice={notice}
                  profile={profile}
                  users={usersQuery.data ?? []}
                  usersError={usersQuery.error}
                  onSignOut={handleSignOut}
                />
              ) : (
                <LoginPanel
                  isBusy={isBusy}
                  isHydrated={isHydrated}
                  notice={
                    notice ?? (profileQuery.error ? getApiErrorMessage(profileQuery.error) : null)
                  }
                  password={password}
                  username={username}
                  onPasswordChange={setPassword}
                  onSubmit={handleSubmit}
                  onUsernameChange={setUsername}
                />
              )}
            </section>

            <aside className="rounded-xl border border-border bg-card/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Current setup
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Credentials come from <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code>.
                </p>
                <p>
                  The workspace on <code>/</code> still stays public in this pass.
                </p>
                <p>
                  The <code>/api/users</code> list stays available after sign-in.
                </p>
              </div>
            </aside>
          </main>
        </div>
      </div>
    </AppShell>
  );
}

const LoginPanel = ({
  isBusy,
  isHydrated,
  notice,
  password,
  username,
  onPasswordChange,
  onSubmit,
  onUsernameChange,
}: {
  isBusy: boolean;
  isHydrated: boolean;
  notice: string | null;
  password: string;
  username: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onUsernameChange: (value: string) => void;
}) => (
  <form className="space-y-6" onSubmit={onSubmit}>
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold text-foreground">Access the auth flow</h2>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
        Sign in, inspect the current session, and access the sample users endpoint.
      </p>
    </div>

    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="auth-username">
          Username
        </label>
        <Input
          id="auth-username"
          autoComplete="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="Enter username"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="auth-password">
          Password
        </label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Enter password"
          required
        />
      </div>
    </div>

    {notice ? (
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
        <span>{notice}</span>
      </div>
    ) : null}

    <Button type="submit" size="lg" disabled={!isHydrated || isBusy} className="w-full sm:w-auto">
      {isBusy ? 'Signing in...' : 'Sign in'}
    </Button>
  </form>
);

const SessionPanel = ({
  isBusy,
  notice,
  profile,
  users,
  usersError,
  onSignOut,
}: {
  isBusy: boolean;
  notice: string | null;
  profile: AdminProfileResponse;
  users: Array<{ id: number; name: string; roles: string[] }>;
  usersError: unknown;
  onSignOut: () => void;
}) => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <h2 className="text-2xl font-semibold text-foreground">{profile.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{profile.role}</Badge>
          {profile.roles.map((role) => (
            <Badge key={role} variant="outline">
              {role}
            </Badge>
          ))}
        </div>
      </div>

      <Button type="button" variant="outline" onClick={onSignOut} disabled={isBusy}>
        {isBusy ? 'Working...' : 'Sign out'}
      </Button>
    </div>

    {notice ? (
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
        <span>{notice}</span>
      </div>
    ) : null}

    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Users
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Available sample accounts</h3>
        </div>
        <Badge variant="secondary">{users.length} loaded</Badge>
      </div>

      {usersError ? (
        <p className="mt-4 text-sm text-destructive">{getApiErrorMessage(usersError)}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground">User #{user.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={`${user.id}-${role}`} variant="outline">
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
);
