import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMemoryHistory } from '@tanstack/react-router';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const clientTemplatePath = path.resolve(__dirname, './dist/client/index.html');
const serverEntryPath = path.resolve(__dirname, './dist/server/entry-server.js');

app.use(express.static(path.resolve(__dirname, './dist/client'), { index: false }));

function getPublicEnvVars(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith('VITE_'))
      .map(([key, value]) => [key, value ?? '']),
  );
}

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverEntry = await loadServerEntry();
    const { createRouter, render } = serverEntry;

    const router = createRouter();
    const history = createMemoryHistory({ initialEntries: [req.originalUrl] });
    router.update({ history });
    await router.load();

    if (router.hasNotFoundMatch()) {
      return res.status(404).send('<h1>404 - Page Not Found</h1>');
    }

    const template = fs.readFileSync(clientTemplatePath, 'utf-8');
    const appHtml = await render(router);
    const envVars = getPublicEnvVars();
    const envScript = `<script>window.__ENV__ = ${JSON.stringify(envVars)};</script>`;
    const html = template
      .replace('<!--app-html-->', appHtml)
      .replace('</head>', `${envScript}\n</head>`);

    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  } catch (e) {
    next(e);
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Frontend server running on http://localhost:${port}`);
});

async function loadServerEntry() {
  const serverEntryUrl = pathToFileURL(serverEntryPath);
  const serverEntryStat = await fs.promises.stat(serverEntryPath);
  serverEntryUrl.searchParams.set('t', String(serverEntryStat.mtimeMs));

  return import(serverEntryUrl.href);
}
