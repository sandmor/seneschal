import path from 'node:path';
import {
  baseEnv,
  dataDirectory,
  frontendPort,
  host,
  internalApiUrl,
  publicApiUrl,
  publicFrontendUrl,
  rootDir,
  runCommand,
  spawnManagedProcess,
  waitForLinkedProcesses,
  waitForSingleProcess,
} from './runtime.js';

type Mode = 'all' | 'backend' | 'frontend';
const backendPort = baseEnv.BACKEND_PORT ?? '8000';

const mode = parseMode(process.argv[2]);

await run(mode);

async function run(selectedMode: Mode) {
  await buildFrontendOnce();

  if (selectedMode === 'backend') {
    const backend = spawnBackend();
    await waitForSingleProcess(backend);
    return;
  }

  if (selectedMode === 'frontend') {
    await waitForLinkedProcesses(spawnFrontendProcesses());
    return;
  }

  const backend = spawnBackend();
  const frontendProcesses = spawnFrontendProcesses();

  await waitForLinkedProcesses([backend, ...frontendProcesses]);
}

function spawnBackend() {
  return spawnManagedProcess(
    'backend',
    'uv',
    [
      'run',
      '--package',
      'backend',
      'uvicorn',
      '--app-dir',
      'backend',
      'src.main:app',
      '--reload',
      '--host',
      host,
      '--port',
      backendPort,
    ],
    {
      cwd: rootDir,
      env: {
        ...baseEnv,
        DATA_DIRECTORY: dataDirectory,
        PUBLIC_FRONTEND_URL: publicFrontendUrl,
      },
    },
  );
}

async function buildFrontendOnce() {
  await runCommand('frontend-build', 'bun', ['run', 'build'], {
    cwd: path.join(rootDir, 'frontend'),
    env: {
      ...baseEnv,
      FRONTEND_PORT: frontendPort,
      VITE_PUBLIC_API_URL: publicApiUrl,
      INTERNAL_API_URL: internalApiUrl,
    },
  });
}

function spawnFrontendProcesses() {
  const frontendCwd = path.join(rootDir, 'frontend');
  const frontendEnv = {
    ...baseEnv,
    FRONTEND_PORT: frontendPort,
    PORT: frontendPort,
    VITE_PUBLIC_API_URL: publicApiUrl,
    INTERNAL_API_URL: internalApiUrl,
  };

  return [
    spawnManagedProcess('frontend-client-build', 'bun', ['run', 'build:client:watch'], {
      cwd: frontendCwd,
      env: frontendEnv,
    }),
    spawnManagedProcess('frontend-server-build', 'bun', ['run', 'build:server:watch'], {
      cwd: frontendCwd,
      env: frontendEnv,
    }),
    spawnManagedProcess('frontend', 'bun', ['run', 'start:watch'], {
      cwd: frontendCwd,
      env: frontendEnv,
    }),
  ];
}

function parseMode(rawMode: string | undefined): Mode {
  if (rawMode === undefined || rawMode === 'all') {
    return 'all';
  }

  if (rawMode === 'backend' || rawMode === 'frontend') {
    return rawMode;
  }

  throw new Error(`Unsupported dev mode '${rawMode}'. Expected all, backend, or frontend.`);
}
