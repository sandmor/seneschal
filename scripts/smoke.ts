import path from 'node:path';
import {
  assertIncludes,
  baseEnv,
  cleanupProcesses,
  dockerCompose,
  fetchJson,
  fetchText,
  host,
  internalApiUrl,
  publicApiUrl,
  publicFrontendUrl,
  rootDir,
  runCommand,
  spawnManagedProcess,
  waitForUrl,
} from './runtime.js';

type SmokeMode = 'local' | 'docker';
type LoginResponse = { token: string };
type AdminProfile = { name: string; role: string };
type Role = { id: number; name: string; description: string };
type ManagedUser = { id: number; username: string; is_active: boolean; roles: Role[] };
type PublicUser = { id: number; name: string; roles: string[]; permissions: string[] };
type AuthorizationHeaders = { Authorization: string };

const mode = parseMode(process.argv[2]);
const adminUsername = baseEnv.ADMIN_USERNAME ?? 'admin';
const adminPassword = baseEnv.ADMIN_PASSWORD ?? 'admin123';

if (mode === 'local') {
  await runLocalSmoke();
} else {
  await runDockerSmoke();
}

async function runLocalSmoke() {
  await runCommand('orval-bootstrap', 'bun', ['run', './scripts/orval.ts'], {
    cwd: rootDir,
    env: baseEnv,
  });

  const backendPort = baseEnv.BACKEND_PORT ?? '8000';
  const frontendPort = baseEnv.FRONTEND_PORT ?? '3000';
  const backend = spawnManagedProcess(
    'smoke-backend',
    'uv',
    [
      'run',
      '--package',
      'backend',
      'uvicorn',
      '--app-dir',
      'backend',
      'src.main:app',
      '--host',
      host,
      '--port',
      backendPort,
    ],
    {
      cwd: rootDir,
      env: {
        ...baseEnv,
        PUBLIC_FRONTEND_URL: publicFrontendUrl,
      },
    },
  );

  try {
    await waitForUrl(`http://${host}:${backendPort}/health`);

    await runCommand('frontend-build', 'bun', ['run', 'build'], {
      cwd: path.join(rootDir, 'frontend'),
      env: {
        ...baseEnv,
        INTERNAL_API_URL: internalApiUrl,
        VITE_PUBLIC_API_URL: publicApiUrl,
      },
    });

    const frontend = spawnManagedProcess('smoke-frontend', 'bun', ['server.ts'], {
      cwd: path.join(rootDir, 'frontend'),
      env: {
        ...baseEnv,
        PORT: frontendPort,
        INTERNAL_API_URL: internalApiUrl,
        VITE_PUBLIC_API_URL: publicApiUrl,
      },
    });

    try {
      await waitForUrl(`http://${host}:${frontendPort}/health`);

      const authorizationHeaders = await loginAsAdmin(`http://${host}:${backendPort}`);
      const backendRootDirectory = await fetchText(
        `http://${host}:${backendPort}/api/directories?path=/`,
        { headers: authorizationHeaders },
      );
      const frontendHtml = await fetchText(`http://${host}:${frontendPort}/`);
      const authHtml = await fetchText(`http://${host}:${frontendPort}/auth`);

      assertIncludes(backendRootDirectory, '"kind":"directory"', 'backend root directory payload');
      assertIncludes(frontendHtml, '<title>Seneschal</title>', 'frontend HTML');
      assertIncludes(authHtml, 'Authentication', 'auth route HTML');
      await exerciseAuthFlow(`http://${host}:${backendPort}`, authorizationHeaders);
    } finally {
      cleanupProcesses([frontend]);
    }
  } finally {
    cleanupProcesses([backend]);
  }
}

async function runDockerSmoke() {
  const backendPort = baseEnv.BACKEND_PORT ?? '8000';
  const frontendPort = baseEnv.FRONTEND_PORT ?? '3000';

  try {
    await dockerCompose(['up', '--build', '-d']);
    await waitForUrl(`http://${host}:${backendPort}/health`, {
      attempts: 40,
      delayMs: 2000,
    });
    await waitForUrl(`http://${host}:${frontendPort}/health`, {
      attempts: 40,
      delayMs: 2000,
    });

    const authorizationHeaders = await loginAsAdmin(`http://${host}:${backendPort}`);
    const backendRootDirectory = await fetchText(
      `http://${host}:${backendPort}/api/directories?path=/`,
      { headers: authorizationHeaders },
    );
    const frontendHtml = await fetchText(`http://${host}:${frontendPort}/`);
    const authHtml = await fetchText(`http://${host}:${frontendPort}/auth`);

    assertIncludes(backendRootDirectory, '"kind":"directory"', 'backend root directory payload');
    assertIncludes(frontendHtml, '<title>Seneschal</title>', 'frontend HTML');
    assertIncludes(authHtml, 'Authentication', 'auth route HTML');
    await exerciseAuthFlow(`http://${host}:${backendPort}`, authorizationHeaders);
  } finally {
    await dockerCompose(['down', '--volumes', '--remove-orphans']);
  }
}

function parseMode(rawMode: string | undefined): SmokeMode {
  if (rawMode === undefined || rawMode === 'local') {
    return 'local';
  }

  if (rawMode === 'docker') {
    return 'docker';
  }

  throw new Error(`Unsupported smoke mode '${rawMode}'. Expected local or docker.`);
}

async function loginAsAdmin(apiBaseUrl: string): Promise<AuthorizationHeaders> {
  const login = await fetchJson<LoginResponse>(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
  });

  return {
    Authorization: `Bearer ${login.token}`,
  };
}

async function exerciseAuthFlow(apiBaseUrl: string, authorizationHeaders: AuthorizationHeaders) {
  const smokeRunId = Date.now().toString(36);
  const roleName = `editor-${smokeRunId}`;
  const username = `smoke-user-${smokeRunId}`;
  const profile = await fetchJson<AdminProfile>(`${apiBaseUrl}/api/auth/me`, {
    headers: authorizationHeaders,
  });
  const usersBefore = await fetchJson<PublicUser[]>(`${apiBaseUrl}/api/users`, {
    headers: authorizationHeaders,
  });
  const createdRole = await fetchJson<Role>(`${apiBaseUrl}/api/admin/roles`, {
    method: 'POST',
    headers: {
      ...authorizationHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: roleName,
      description: 'Can edit content',
    }),
  });
  const createdUser = await fetchJson<ManagedUser>(`${apiBaseUrl}/api/admin/users`, {
    method: 'POST',
    headers: {
      ...authorizationHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password: 'smoke-password',
    }),
  });
  await fetchJson(`${apiBaseUrl}/api/admin/users/${createdUser.id}/roles/${createdRole.id}`, {
    method: 'POST',
    headers: authorizationHeaders,
  });
  const managedUsers = await fetchJson<ManagedUser[]>(`${apiBaseUrl}/api/admin/users`, {
    headers: authorizationHeaders,
  });
  const managedRoles = await fetchJson<Role[]>(`${apiBaseUrl}/api/admin/roles`, {
    headers: authorizationHeaders,
  });
  const usersAfter = await fetchJson<PublicUser[]>(`${apiBaseUrl}/api/users`, {
    headers: authorizationHeaders,
  });
  const logout = await fetchJson<{ status: string }>(`${apiBaseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: authorizationHeaders,
  });

  if (profile.name !== adminUsername) {
    throw new Error(
      `Expected authenticated profile name '${adminUsername}', received '${profile.name}'.`,
    );
  }

  if (profile.role !== 'superadmin') {
    throw new Error(
      `Expected authenticated profile role 'superadmin', received '${profile.role}'.`,
    );
  }

  if (!usersBefore.every((user) => Array.isArray(user.roles) && Array.isArray(user.permissions))) {
    throw new Error('Expected /api/users to return users with roles and permissions arrays.');
  }

  if (!managedRoles.some((role) => role.id === createdRole.id && role.name === roleName)) {
    throw new Error('Expected created role to be returned by /api/admin/roles.');
  }

  const managedUser = managedUsers.find((user) => user.id === createdUser.id);
  if (!managedUser) {
    throw new Error('Expected created user to be returned by /api/admin/users.');
  }

  if (managedUser.username !== username) {
    throw new Error(`Expected created username '${username}', received '${managedUser.username}'.`);
  }

  if (!managedUser.roles.some((role) => role.id === createdRole.id)) {
    throw new Error('Expected assigned role to be present on created managed user.');
  }

  const publicUser = usersAfter.find((user) => user.id === createdUser.id);
  if (!publicUser) {
    throw new Error('Expected created user to be returned by /api/users.');
  }

  if (!publicUser.roles.includes(roleName)) {
    throw new Error('Expected created role to be present on created public user.');
  }

  if (logout.status !== 'ok') {
    throw new Error(`Expected logout status 'ok', received '${logout.status}'.`);
  }
}
