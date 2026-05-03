import { baseEnv, host, rootDir, runCommand, spawnManagedProcess, waitForUrl } from './runtime.js';

const backendPort = baseEnv.BACKEND_PORT ?? '8000';
const openApiUrl = `http://${host}:${backendPort}/openapi.json`;

const backend = spawnManagedProcess(
  'orval-backend',
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
    env: baseEnv,
  },
);

try {
  await waitForUrl(openApiUrl);

  await runCommand('orval', 'bun', ['run', '--cwd', 'frontend', 'api:generate'], {
    cwd: rootDir,
    env: {
      ...baseEnv,
      OPENAPI_URL: openApiUrl,
    },
  });
} finally {
  if (backend.child.exitCode === null) {
    backend.child.kill();
  }
}
