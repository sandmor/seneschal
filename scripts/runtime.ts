import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export type ManagedProcess = {
  child: ChildProcess;
  label: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(scriptDir, '..');

export const fileEnv = loadEnvFile(path.join(rootDir, '.env'));
export const baseEnv: NodeJS.ProcessEnv = {
  ...fileEnv,
  ...process.env,
};

export const host = baseEnv.HOST ?? '127.0.0.1';
export const backendPort = baseEnv.BACKEND_PORT ?? '8000';
export const frontendPort = baseEnv.FRONTEND_PORT ?? '3000';
export const dataDirectory = baseEnv.DATA_DIRECTORY ?? path.join(rootDir, 'data');
export const publicFrontendUrl = baseEnv.PUBLIC_FRONTEND_URL ?? `http://${host}:${frontendPort}`;
export const publicApiUrl = baseEnv.VITE_PUBLIC_API_URL ?? `http://${host}:${backendPort}`;
export const internalApiUrl = baseEnv.INTERNAL_API_URL ?? `http://${host}:${backendPort}`;

export function spawnManagedProcess(
  label: string,
  command: string,
  args: string[],
  options: SpawnOptions,
): ManagedProcess {
  const child = spawn(command, args, {
    ...options,
    stdio: 'inherit',
  });

  child.on('error', (error: Error) => {
    console.error(`[${label}] failed to start: ${error.message}`);
  });

  return { child, label };
}

export async function waitForSingleProcess(processHandle: ManagedProcess) {
  const interruptController = new InterruptController();
  interruptController.attach([processHandle]);

  const result = await waitForExit(processHandle);
  process.exitCode = interruptController.resolveExitCode(result.code, result.signal);
}

export async function waitForLinkedProcesses(processHandles: ManagedProcess[]) {
  const interruptController = new InterruptController();
  let shuttingDown = false;

  const shutdown = (trigger?: ManagedProcess) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const processHandle of processHandles) {
      if (processHandle !== trigger && processHandle.child.exitCode === null) {
        processHandle.child.kill();
      }
    }
  };

  interruptController.attach(processHandles, () => shutdown());

  const exitPromises = processHandles.map((processHandle) =>
    waitForExit(processHandle).then((result) => {
      shutdown(processHandle);
      return result;
    }),
  );

  const firstExit = await Promise.race(exitPromises);
  await Promise.all(exitPromises);

  process.exitCode = interruptController.resolveExitCode(firstExit.code, firstExit.signal);
}

export async function waitForUrl(
  url: string,
  options?: {
    attempts?: number;
    delayMs?: number;
  },
) {
  const attempts = options?.attempts ?? 30;
  const delayMs = options?.delayMs ?? 1000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The process may not be ready yet.
    }

    await sleep(delayMs);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

export async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  return response.text();
}

export async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Request to ${url} failed with status ${response.status}: ${payload}`);
  }

  return (await response.json()) as T;
}

export function assertIncludes(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to include '${needle}'.`);
  }
}

export async function runCommand(
  label: string,
  command: string,
  args: string[],
  options: SpawnOptions,
) {
  const processHandle = spawnManagedProcess(label, command, args, options);
  const result = await waitForExit(processHandle);

  if (result.code !== 0) {
    throw new Error(
      `[${label}] exited with code ${result.code ?? 'null'}${result.signal ? ` (${result.signal})` : ''}`,
    );
  }
}

export function cleanupProcesses(processHandles: ManagedProcess[]) {
  for (const processHandle of processHandles) {
    if (processHandle.child.exitCode === null) {
      processHandle.child.kill();
    }
  }
}

export async function dockerCompose(args: string[]) {
  await runCommand('docker-compose', 'docker', ['compose', ...args], {
    cwd: rootDir,
    env: baseEnv,
  });
}

function waitForExit(processHandle: ManagedProcess) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    processHandle.child.once('exit', (code: number | null, signal: NodeJS.Signals | null) =>
      resolve({ code, signal }),
    );
  });
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(rawValue);
  }

  return env;
}

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

class InterruptController {
  private interrupted = false;

  attach(processHandles: ManagedProcess[], onSignal?: () => void) {
    const handler = () => {
      this.interrupted = true;
      onSignal?.();

      cleanupProcesses(processHandles);
    };

    process.once('SIGINT', handler);
    process.once('SIGTERM', handler);
  }

  resolveExitCode(code: number | null, signal: NodeJS.Signals | null) {
    if (this.interrupted && (signal === 'SIGINT' || signal === 'SIGTERM' || code === null)) {
      return 0;
    }

    if (typeof code === 'number') {
      return code;
    }

    if (signal) {
      return 1;
    }

    return 0;
  }
}
