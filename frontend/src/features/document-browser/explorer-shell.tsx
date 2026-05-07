import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AppShell, InspectorPanel } from '@/components/app-shell';
import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createDirectory,
  createDocument,
  deleteDirectory,
  deleteDocument,
  directoryQueryKey,
  documentQueryKey,
  ExplorerDirectory,
  ExplorerDocument,
  ExplorerNode,
  getApiErrorMessage,
  getDirectory,
  getDocument,
  updateDirectory,
  updateDocument,
} from '@/features/document-browser/document-browser-api';
import {
  ensureMarkdownExtension,
  getBreadcrumbs,
  getParentPath,
  getPathName,
  joinPath,
  stripMarkdownExtension,
} from '@/features/document-browser/path-utils';
import { cn } from '@/lib/utils';

type ExplorerShellProps = {
  directoryPath: string;
  documentPath?: string;
};

type StatusTone = 'default' | 'error';

type StatusState = {
  message: string;
  tone: StatusTone;
} | null;

/**
 * ExplorerShell is the main container for the document browser.
 * It manages the state and interactions for browsing directories, viewing and editing documents.
 */
export function ExplorerShell({ directoryPath, documentPath }: ExplorerShellProps) {
  const navigate = useNavigate({ from: '/' });
  const queryClient = useQueryClient();
  const [newDirectoryName, setNewDirectoryName] = useState('');
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentContent, setNewDocumentContent] = useState('# ');
  const [directoryName, setDirectoryName] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);

  const directoryQuery = useQuery({
    queryKey: directoryQueryKey(directoryPath),
    queryFn: () => getDirectory(directoryPath),
  });

  const documentQuery = useQuery({
    queryKey: documentQueryKey(documentPath ?? ''),
    queryFn: () => getDocument(documentPath ?? ''),
    enabled: Boolean(documentPath),
  });

  const currentDirectory = directoryQuery.data;
  const selectedDocument = documentQuery.data;
  const breadcrumbs = useMemo(() => getBreadcrumbs(directoryPath), [directoryPath]);
  const rootDocumentsBlocked = directoryPath === '/';

  useEffect(() => {
    if (!currentDirectory) return;
    setDirectoryName(currentDirectory.path === '/' ? '' : getPathName(currentDirectory.path));
  }, [currentDirectory]);

  useEffect(() => {
    if (!selectedDocument) {
      setDocumentName('');
      setDocumentContent('');
      return;
    }
    setDocumentName(stripMarkdownExtension(selectedDocument.name));
    setDocumentContent(selectedDocument.content);
    setInspectorOpen(true);
  }, [selectedDocument]);

  const createDirectoryMutation = useMutation({
    mutationFn: createDirectory,
    onSuccess: async () => {
      setNewDirectoryName('');
      await refreshDirectory(currentDirectory?.path ?? directoryPath, queryClient);
      setStatus({ message: 'Directory created.', tone: 'default' });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const createDocumentMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      createDocument(path, content),
    onSuccess: async (document) => {
      setNewDocumentName('');
      setNewDocumentContent('# ');
      setNewDocDialogOpen(false);
      await Promise.all([
        refreshDirectory(document.parent_path, queryClient),
        queryClient.invalidateQueries({ queryKey: documentQueryKey(document.path) }),
      ]);
      setStatus({ message: 'Document created.', tone: 'default' });
      void navigate({
        search: (previous) => ({
          ...previous,
          path: document.parent_path,
          document: document.path,
        }),
      });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const updateDirectoryMutation = useMutation({
    mutationFn: ({ path, newPath }: { path: string; newPath: string }) =>
      updateDirectory(path, newPath),
    onSuccess: async (directory, variables) => {
      await Promise.all([
        refreshDirectory(directory.path, queryClient),
        refreshDirectory(getParentPath(variables.path), queryClient),
        refreshDirectory(getParentPath(directory.path), queryClient),
      ]);
      setStatus({ message: 'Directory updated.', tone: 'default' });
      void navigate({ search: (previous) => ({ ...previous, path: directory.path }) });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const deleteDirectoryMutation = useMutation({
    mutationFn: ({ path, recursive }: { path: string; recursive: boolean }) =>
      deleteDirectory(path, recursive),
    onSuccess: async (_, variables) => {
      const parentPath = getParentPath(variables.path);
      await Promise.all([
        refreshDirectory(parentPath, queryClient),
        queryClient.removeQueries({ queryKey: directoryQueryKey(variables.path) }),
      ]);
      setInspectorOpen(false);
      setStatus({ message: 'Directory deleted.', tone: 'default' });
      void navigate({
        search: (previous) => ({ ...previous, path: parentPath, document: undefined }),
      });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({
      path,
      content,
      newPath,
    }: {
      path: string;
      content?: string;
      newPath?: string;
    }) => updateDocument(path, { content, newPath }),
    onSuccess: async (document, variables) => {
      await Promise.all([
        refreshDirectory(document.parent_path, queryClient),
        refreshDirectory(getParentPath(variables.path), queryClient),
        queryClient.invalidateQueries({ queryKey: documentQueryKey(document.path) }),
      ]);
      setStatus({ message: 'Document updated.', tone: 'default' });
      void navigate({
        search: (previous) => ({
          ...previous,
          path: document.parent_path,
          document: document.path,
        }),
      });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async (_, path) => {
      const parentPath = getParentPath(path);
      await Promise.all([
        refreshDirectory(parentPath, queryClient),
        queryClient.removeQueries({ queryKey: documentQueryKey(path) }),
      ]);
      setInspectorOpen(false);
      setStatus({ message: 'Document deleted.', tone: 'default' });
      void navigate({
        search: (previous) => ({ ...previous, path: parentPath, document: undefined }),
      });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const isBusy =
    createDirectoryMutation.isPending ||
    createDocumentMutation.isPending ||
    updateDirectoryMutation.isPending ||
    deleteDirectoryMutation.isPending ||
    updateDocumentMutation.isPending ||
    deleteDocumentMutation.isPending;

  const handleOpenDirectory = (path: string) => {
    void navigate({ search: (previous) => ({ ...previous, path, document: undefined }) });
  };

  const handleOpenDocument = (path: string) => {
    void navigate({
      search: (previous) => ({ ...previous, path: getParentPath(path), document: path }),
    });
  };

  const handleCreateDirectory = () => {
    if (!newDirectoryName.trim()) {
      setStatus({ message: 'Directory name is required.', tone: 'error' });
      return;
    }
    createDirectoryMutation.mutate(joinPath(directoryPath, newDirectoryName));
  };

  const handleCreateDocument = () => {
    const normalizedName = ensureMarkdownExtension(newDocumentName);
    if (!normalizedName) {
      setStatus({ message: 'Document name is required.', tone: 'error' });
      return;
    }
    createDocumentMutation.mutate({
      path: joinPath(directoryPath, normalizedName),
      content: newDocumentContent,
    });
  };

  const handleUpdateDirectory = () => {
    if (!currentDirectory || currentDirectory.path === '/') return;
    if (!directoryName.trim()) {
      setStatus({ message: 'Directory name is required.', tone: 'error' });
      return;
    }
    updateDirectoryMutation.mutate({
      path: currentDirectory.path,
      newPath: joinPath(getParentPath(currentDirectory.path), directoryName),
    });
  };

  const handleDeleteDirectory = () => {
    if (!currentDirectory || currentDirectory.path === '/') return;
    deleteDirectoryMutation.mutate({ path: currentDirectory.path, recursive: true });
  };

  const handleSaveDocument = () => {
    if (!selectedDocument) return;
    const normalizedName = ensureMarkdownExtension(documentName);
    if (!normalizedName) {
      setStatus({ message: 'Document name is required.', tone: 'error' });
      return;
    }
    updateDocumentMutation.mutate({
      path: selectedDocument.path,
      content: documentContent,
      newPath: joinPath(selectedDocument.parent_path, normalizedName),
    });
  };

  const handleDeleteDocument = () => {
    if (!selectedDocument) return;
    deleteDocumentMutation.mutate(selectedDocument.path);
  };

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
    void navigate({ search: (previous) => ({ ...previous, document: undefined }) });
  }, [navigate]);

  const sidebarContent = (
    <Sidebar
      breadcrumbs={breadcrumbs}
      currentPath={directoryPath}
      directoryCount={currentDirectory?.child_directories_count ?? 0}
      documentCount={currentDirectory?.child_documents_count ?? 0}
      onNavigate={handleOpenDirectory}
    />
  );

  const inspectorTitle = selectedDocument ? 'Document inspector' : 'Directory controls';
  const showDirInspector = !selectedDocument && currentDirectory && currentDirectory.path !== '/';

  return (
    <AppShell sidebar={sidebarContent}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border">/</span>}
                <button
                  type="button"
                  className={cn(
                    'truncate transition-colors hover:text-foreground',
                    i === breadcrumbs.length - 1 && 'font-medium text-foreground',
                  )}
                  onClick={() => handleOpenDirectory(crumb.path)}
                >
                  {i === 0 ? 'Root' : crumb.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input
              value={newDirectoryName}
              onChange={(e) => setNewDirectoryName(e.target.value)}
              placeholder="New folder…"
              className="h-8 w-36 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDirectory()}
            />
            <Button size="sm" variant="secondary" onClick={handleCreateDirectory} disabled={isBusy}>
              <FolderPlusIcon className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {!rootDocumentsBlocked && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setNewDocDialogOpen(true)}
              disabled={isBusy}
            >
              <FilePlusIcon className="h-3.5 w-3.5" />
              New doc
            </Button>
          )}
          {showDirInspector && (
            <Button size="sm" variant="ghost" onClick={() => setInspectorOpen(true)}>
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Status toast */}
      {status && (
        <div className="px-4 pt-3 sm:px-6">
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
              status.tone === 'error'
                ? 'border-destructive/30 bg-destructive/8 text-destructive'
                : 'border-primary/20 bg-primary/5 text-foreground',
            )}
          >
            <span>{status.message}</span>
            <button
              type="button"
              className="ml-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setStatus(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 px-4 py-3 sm:px-6">
        {directoryQuery.isLoading ? (
          <EmptyState title="Loading…" description="Reading directory contents." />
        ) : directoryQuery.isError ? (
          <EmptyState title="Error" description={getApiErrorMessage(directoryQuery.error)} />
        ) : currentDirectory && currentDirectory.children.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px] gap-3 border-b border-border bg-muted/50 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Name</span>
              <span>Type</span>
              <span>Details</span>
            </div>
            <div className="divide-y divide-border">
              {currentDirectory.children.map((node: ExplorerNode) => (
                  <ExplorerRow
                    key={node.path}
                    node={node}
                    isSelected={node.path === documentPath}
                    onSelect={() =>
                      node.kind === 'directory'
                        ? handleOpenDirectory(node.path)
                        : handleOpenDocument(node.path)
                    }
                  />
                ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Empty directory"
            description={
              rootDocumentsBlocked
                ? 'Create a folder to get started. Documents can be added inside folders.'
                : 'Create a folder or a markdown document.'
            }
          />
        )}
      </div>

      {/* Inspector panel */}
      <InspectorPanel open={inspectorOpen} onClose={closeInspector} title={inspectorTitle}>
        {selectedDocument ? (
          <DocumentInspector
            document={selectedDocument}
            documentName={documentName}
            documentContent={documentContent}
            isLoading={documentQuery.isLoading}
            isBusy={isBusy}
            onDocumentNameChange={setDocumentName}
            onDocumentContentChange={setDocumentContent}
            onSave={handleSaveDocument}
            onDelete={handleDeleteDocument}
          />
        ) : currentDirectory && currentDirectory.path !== '/' ? (
          <DirectoryInspector
            directory={currentDirectory}
            directoryName={directoryName}
            isBusy={isBusy}
            onDirectoryNameChange={setDirectoryName}
            onSave={handleUpdateDirectory}
            onDelete={handleDeleteDirectory}
          />
        ) : null}
      </InspectorPanel>

      {/* New document dialog */}
      <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                File name
              </label>
              <Input
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                placeholder="briefing.md"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Content
              </label>
              <Textarea
                className="min-h-40"
                value={newDocumentContent}
                onChange={(e) => setNewDocumentContent(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNewDocDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDocument} disabled={isBusy}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/**
 * ExplorerRow represents a single row in the file list, displaying either a directory or a document.
 */
const ExplorerRow = ({
  node,
  isSelected,
  onSelect,
}: {
  node: ExplorerNode;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const details =
    node.kind === 'directory'
      ? `${node.child_directories_count}d / ${node.child_documents_count}f`
      : `${Math.max(1, Math.ceil(('size_bytes' in node ? node.size_bytes : 0) / 1024))} KB`;

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors sm:grid sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-3',
        isSelected ? 'bg-accent/60' : 'hover:bg-muted/60',
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <NodeGlyph kind={node.kind} />
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{node.name}</span>
          <span className="block truncate text-xs text-muted-foreground sm:hidden">
            {node.kind} · {details}
          </span>
        </div>
      </div>
      <Badge className="hidden sm:inline-flex">{node.kind}</Badge>
      <span className="hidden text-xs text-muted-foreground sm:block">{details}</span>
    </button>
  );
};

/**
 * DirectoryInspector is the component shown in the inspector panel when a directory is selected.
 */
const DirectoryInspector = ({
  directory,
  directoryName,
  isBusy,
  onDirectoryNameChange,
  onSave,
  onDelete,
}: {
  directory: ExplorerDirectory;
  directoryName: string;
  isBusy: boolean;
  onDirectoryNameChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) => {
  const isRoot = directory.path === '/';
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground">
          {isRoot ? 'Root archive' : directory.name}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{directory.path}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Directory name
        </label>
        <Input
          value={directoryName}
          onChange={(e) => onDirectoryNameChange(e.target.value)}
          disabled={isRoot}
          placeholder="archive-branch"
        />
        <p className="mt-2 text-xs text-muted-foreground">Root cannot be renamed or deleted.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onSave} disabled={isBusy || isRoot}>
          Save
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isBusy || isRoot}>
          Delete
        </Button>
      </div>
    </div>
  );
};

/**
 * DocumentInspector is the component shown in the inspector panel when a document is selected.
 */
const DocumentInspector = ({
  document,
  documentName,
  documentContent,
  isLoading,
  isBusy,
  onDocumentNameChange,
  onDocumentContentChange,
  onSave,
  onDelete,
}: {
  document?: ExplorerDocument;
  documentName: string;
  documentContent: string;
  isLoading: boolean;
  isBusy: boolean;
  onDocumentNameChange: (value: string) => void;
  onDocumentContentChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) => {
  if (isLoading) return <EmptyState title="Loading…" description="Opening document." />;
  if (!document) return <EmptyState title="No document" description="Select a document to edit." />;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground">{document.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{document.path}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">File name</label>
        <Input
          value={documentName}
          onChange={(e) => onDocumentNameChange(e.target.value)}
          placeholder="briefing"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Content</label>
        <Textarea
          className="min-h-64 font-mono text-xs"
          value={documentContent}
          onChange={(e) => onDocumentContentChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onSave} disabled={isBusy}>
          Save
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isBusy}>
          Delete
        </Button>
      </div>
    </div>
  );
};

const EmptyState = ({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) => (
  <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
      <EmptyIcon className="h-5 w-5 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
  </div>
);

const NodeGlyph = ({ kind }: { kind: ExplorerNode['kind'] }) => {
  if (kind === 'directory') {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M3 7.75A2.75 2.75 0 0 1 5.75 5h4.39a2 2 0 0 1 1.42.59l1.1 1.1a2 2 0 0 0 1.42.58h4.17A2.75 2.75 0 0 1 21 10.02v6.23A2.75 2.75 0 0 1 18.25 19H5.75A2.75 2.75 0 0 1 3 16.25z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-accent-foreground">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
        <path d="M7.75 3h5.19a2 2 0 0 1 1.42.59l3.05 3.05a2 2 0 0 1 .59 1.42v10.19A2.75 2.75 0 0 1 15.25 21h-7.5A2.75 2.75 0 0 1 5 18.25v-12.5A2.75 2.75 0 0 1 7.75 3Z" />
        <path d="M14 3.5V7a2 2 0 0 0 2 2h3.5" />
        <path d="M8.5 13h7M8.5 16.5h5" />
      </svg>
    </span>
  );
};

const FolderPlusIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 7.75A2.75 2.75 0 0 1 5.75 5h4.39a2 2 0 0 1 1.42.59l1.1 1.1a2 2 0 0 0 1.42.58h4.17A2.75 2.75 0 0 1 21 10.02v6.23A2.75 2.75 0 0 1 18.25 19H5.75A2.75 2.75 0 0 1 3 16.25z" />
    <path d="M12 12v4M10 14h4" />
  </svg>
);

const FilePlusIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M7.75 3h5.19a2 2 0 0 1 1.42.59l3.05 3.05a2 2 0 0 1 .59 1.42v10.19A2.75 2.75 0 0 1 15.25 21h-7.5A2.75 2.75 0 0 1 5 18.25v-12.5A2.75 2.75 0 0 1 7.75 3Z" />
    <path d="M12 11v6M9 14h6" />
  </svg>
);

const EmptyIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M3 7.75A2.75 2.75 0 0 1 5.75 5h4.39a2 2 0 0 1 1.42.59l1.1 1.1a2 2 0 0 0 1.42.58h4.17A2.75 2.75 0 0 1 21 10.02v6.23A2.75 2.75 0 0 1 18.25 19H5.75A2.75 2.75 0 0 1 3 16.25z" />
  </svg>
);

async function refreshDirectory(path: string, queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: directoryQueryKey(path) });
}
