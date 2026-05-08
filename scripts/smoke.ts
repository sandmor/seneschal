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
type User = { id: number; name: string; roles: string[] };

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

      const backendRootDirectory = await fetchText(
        `http://${host}:${backendPort}/api/directories?path=/`,
      );
      const frontendHtml = await fetchText(`http://${host}:${frontendPort}/`);
      const authHtml = await fetchText(`http://${host}:${frontendPort}/auth`);

      assertIncludes(backendRootDirectory, '"kind":"directory"', 'backend root directory payload');
      assertIncludes(frontendHtml, '<title>Seneschal</title>', 'frontend HTML');
      assertIncludes(authHtml, 'Authentication', 'auth route HTML');
      await exerciseAuthFlow(`http://${host}:${backendPort}`);
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

    const backendRootDirectory = await fetchText(
      `http://${host}:${backendPort}/api/directories?path=/`,
    );
    const frontendHtml = await fetchText(`http://${host}:${frontendPort}/`);
    const authHtml = await fetchText(`http://${host}:${frontendPort}/auth`);

    assertIncludes(backendRootDirectory, '"kind":"directory"', 'backend root directory payload');
    assertIncludes(frontendHtml, '<title>Seneschal</title>', 'frontend HTML');
    assertIncludes(authHtml, 'Authentication', 'auth route HTML');
    await exerciseAuthFlow(`http://${host}:${backendPort}`);
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

async function exerciseAuthFlow(apiBaseUrl: string) {
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

  const authorizationHeaders = {
    Authorization: `Bearer ${login.token}`,
  };

  const profile = await fetchJson<AdminProfile>(`${apiBaseUrl}/api/auth/me`, {
    headers: authorizationHeaders,
  });
  const users = await fetchJson<User[]>(`${apiBaseUrl}/api/users`, {
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

  if (users.length === 0) {
    throw new Error('Expected at least one placeholder user from /api/users.');
  }

  if (logout.status !== 'ok') {
    throw new Error(`Expected logout status 'ok', received '${logout.status}'.`);
  }
}
