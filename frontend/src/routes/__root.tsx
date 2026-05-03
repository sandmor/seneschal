import { createRootRoute, Outlet } from '@tanstack/react-router';
import { QueryClientProviderAdapter } from '@/providers/query-client-provider';
import { ThemeProvider } from '@/providers/theme-provider';

export const Route = createRootRoute({
  component: () => (
    <QueryClientProviderAdapter>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </QueryClientProviderAdapter>
  ),
});
