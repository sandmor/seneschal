import { createFileRoute } from '@tanstack/react-router';
import { ExplorerShell } from '@/features/document-browser/explorer-shell';

export const Route = createFileRoute('/')({
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
