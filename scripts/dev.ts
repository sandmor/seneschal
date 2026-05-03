import path from 'node:path';
import {
  baseEnv,
  dataDirectory,
  frontendPort,
  host,
  publicApiUrl,
  publicFrontendUrl,
  rootDir,
  spawnManagedProcess,
  waitForLinkedProcesses,
  waitForSingleProcess,
} from './runtime.js';

type Mode = 'all' | 'backend' | 'frontend';
const backendPort = baseEnv.BACKEND_PORT ?? '8000';

const mode = parseMode(process.argv[2]);

await run(mode);

async function run(selectedMode: Mode) {
  if (selectedMode === 'backend') {
    const backend = spawnBackend();
    await waitForSingleProcess(backend);
    return;
  }

  if (selectedMode === 'frontend') {
    const frontend = spawnFrontend();
    await waitForSingleProcess(frontend);
    return;
  }

  const backend = spawnBackend();
  const frontend = spawnFrontend();

  await waitForLinkedProcesses([backend, frontend]);
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

function spawnFrontend() {
  return spawnManagedProcess('frontend', 'bun', ['run', 'dev'], {
    cwd: path.join(rootDir, 'frontend'),
    env: {
      ...baseEnv,
      HOST: host,
      FRONTEND_PORT: frontendPort,
      VITE_PUBLIC_API_URL: publicApiUrl,
    },
  });
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
