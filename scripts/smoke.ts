import path from 'node:path';
import {
  assertIncludes,
  baseEnv,
  cleanupProcesses,
  dockerCompose,
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

const mode = parseMode(process.argv[2]);

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

      assertIncludes(backendRootDirectory, '"kind":"directory"', 'backend root directory payload');
      assertIncludes(frontendHtml, '<title>Seneschal</title>', 'frontend HTML');
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

    assertIncludes(backendRootDirectory, '"kind":"directory"', 'backend root directory payload');
    assertIncludes(frontendHtml, '<title>Seneschal</title>', 'frontend HTML');
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
