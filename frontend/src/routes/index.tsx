import { createFileRoute, redirect } from '@tanstack/react-router';
import { ExplorerShell } from '@/features/document-browser/explorer-shell';
import { getStoredAuthToken } from '@/features/auth/auth-api';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const token = getStoredAuthToken();
    if (!token) {
      throw redirect({ to: '/auth' });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    document:
      typeof search.document === 'string' && search.document.startsWith('/')
        ? search.document
        : undefined,
    path: typeof search.path === 'string' && search.path.startsWith('/') ? search.path : '/',
  }),
  component: () => {
    const search = Route.useSearch();
    return <ExplorerShell directoryPath={search.path} documentPath={search.document} />;
  },
});
