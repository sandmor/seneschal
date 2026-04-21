declare module './dist/server/entry-server.js' {
  import type { AnyRouter } from '@tanstack/react-router';

  export function createRouter(): AnyRouter;
  export function render(router: AnyRouter): Promise<string>;
}
