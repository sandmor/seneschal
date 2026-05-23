import { baseEnv, rootDir, runCommand } from './runtime.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

const openApiFile = path.resolve(rootDir, 'openapi.json');

try {
  await runCommand(
    'extract-spec',
    'uv',
    [
      'run',
      '--package',
      'backend',
      'python',
      '-c',
      `import sys; sys.path.insert(0, './backend'); import json; from src.main import app; json.dump(app.openapi(), open(r'${openApiFile}', 'w'), indent=2)`,
    ],
    {
      cwd: rootDir,
      env: baseEnv,
    },
  );

  await runCommand('orval', 'bun', ['run', '--cwd', 'frontend', 'api:generate'], {
    cwd: rootDir,
    env: {
      ...baseEnv,
      OPENAPI_URL: openApiFile,
    },
  });
} finally {
  if (fs.existsSync(openApiFile)) {
    fs.rmSync(openApiFile);
  }
}
