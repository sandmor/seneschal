import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryHistory } from '@tanstack/react-router';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

const app = express();

app.use(express.static(path.resolve(__dirname, './dist/client'), { index: false }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    // The SSR bundle is generated at build time and loaded dynamically at runtime.
    // @ts-expect-error The built module does not ship TypeScript declarations.
    const { createRouter, render } = await import('./dist/server/entry-server.js');

    const router = createRouter();
    const history = createMemoryHistory({ initialEntries: [req.originalUrl] });
    router.update({ history });
    await router.load();

    if (router.hasNotFoundMatch()) {
      return res.status(404).send('<h1>404 - Page Not Found</h1>');
    }

    const template = fs.readFileSync(path.resolve(__dirname, './dist/client/index.html'), 'utf-8');
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
