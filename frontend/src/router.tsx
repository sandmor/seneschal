import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    defaultNotFoundComponent: () => <div className="p-8 font-bold">404 - Not Found</div>,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
