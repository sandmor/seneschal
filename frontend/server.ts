import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMemoryHistory } from '@tanstack/react-router';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const clientTemplatePath = path.resolve(__dirname, './dist/client/index.html');
const serverEntryPath = path.resolve(__dirname, './dist/server/entry-server.js');

app.use(express.static(path.resolve(__dirname, './dist/client'), { index: false }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

const internalApiUrl = process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000';
app.use(
  createProxyMiddleware({
    target: internalApiUrl,
    changeOrigin: true,
    pathFilter: '/api',
  }),
);

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
    const html = template.replace('<!--app-html-->', appHtml);

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
