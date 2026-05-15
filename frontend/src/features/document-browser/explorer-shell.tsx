import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import { AppShell } from '@/components/app-shell';
import { InspectorPanel } from '@/components/inspector-panel';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExplorerRow } from '@/features/document-browser/explorer-row';
import { DirectoryInspector } from '@/features/document-browser/directory-inspector';
import {
  DocumentEditor,
  DocumentEditorSkeleton,
} from '@/features/document-browser/document-editor';
import { DirectoryResponse, DocumentResponse } from '@/api/models';
import { useDebounce } from '@/features/document-browser/hooks/use-debounce';
import { FolderPlusIcon, FilePlusIcon } from '@/features/document-browser/icons';
import {
  createDirectoryApiDirectoriesPost as createDirectory,
  createDocumentApiDocumentsPost as createDocument,
  deleteDirectoryApiDirectoriesDelete as deleteDirectory,
  deleteDocumentApiDocumentsDelete as deleteDocument,
  getGetDirectoryApiDirectoriesGetQueryKey as directoryQueryKey,
  getGetDocumentApiDocumentsGetQueryKey as documentQueryKey,
  getDirectoryApiDirectoriesGet as getDirectory,
  getDocumentApiDocumentsGet as getDocument,
  updateDirectoryApiDirectoriesPatch as updateDirectory,
  updateDocumentApiDocumentsPatch as updateDocument,
} from '@/api/endpoints/api';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  ensureMarkdownExtension,
  getBreadcrumbs,
  getParentPath,
  getPathName,
  joinPath,
  stripMarkdownExtension,
} from '@/features/document-browser/path-utils';
import { createYjsProvider } from '@/features/editor/yjs-provider';
import { getStoredAuthToken } from '@/features/auth/auth-api';
import { cn } from '@/lib/utils';

export type ExplorerShellProps = {
  directoryPath: string;
  documentPath?: string;
};

type StatusTone = 'default' | 'error' | 'saving';

type StatusState = {
  message: string;
  tone: StatusTone;
} | null;

/**
 * ExplorerShell is the main container for the document browser.
 * It manages the state and interactions for browsing directories, viewing and editing documents.
 *
 * When a document is selected, the view switches to a full-window editor.
 * The inspector panel only shows for directory operations.
 */
export function ExplorerShell({ directoryPath, documentPath }: ExplorerShellProps) {
  const navigate = useNavigate({ from: '/' });
  const queryClient = useQueryClient();
  const [newDirectoryName, setNewDirectoryName] = useState('');
  const [directoryName, setDirectoryName] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const hasUnsavedChangesRef = useRef(false);
  const unsavedChangesTimestampRef = useRef<number | null>(null);
  const lastSeenSaveIdRef = useRef<string | null>(null);
  const [blacklistedLeaderIds, setBlacklistedLeaderIds] = useState<Set<number>>(new Set());

  // Yjs collaborative state
  const [ydoc, setYdoc] = useState<Y.Doc | undefined>(undefined);
  const [provider, setProvider] = useState<WebsocketProvider | undefined>(undefined);
  const [isYjsSynced, setIsYjsSynced] = useState(false);
  const yjsCleanupRef = useRef<(() => void) | null>(null);

  const directoryQuery = useQuery({
    queryKey: directoryQueryKey({ path: directoryPath }),
    queryFn: () => getDirectory({ path: directoryPath }),
    select: (res) =>
      res && 'status' in res && res.status === 200 ? (res.data as DirectoryResponse) : undefined,
  });

  const documentQuery = useQuery({
    queryKey: documentQueryKey({ path: documentPath ?? '' }),
    queryFn: () => getDocument({ path: documentPath ?? '' }),
    enabled: Boolean(documentPath),
    select: (res) =>
      res && 'status' in res && res.status === 200 ? (res.data as DocumentResponse) : undefined,
  });

  const currentDirectory = directoryQuery.data;
  const selectedDocument = documentQuery.data;
  const breadcrumbs = useMemo(() => getBreadcrumbs(directoryPath), [directoryPath]);
  const rootDocumentsBlocked = directoryPath === '/';

  // Debounced content for auto-save
  const debouncedContent = useDebounce(documentContent, 800);

  // Update directory name when directory changes
  useEffect(() => {
    if (!currentDirectory) return;
    setDirectoryName(currentDirectory.path === '/' ? '' : getPathName(currentDirectory.path));
  }, [currentDirectory]);

  const syncedEditorKeyRef = useRef(-1);

  // Manage Yjs connection lifecycle per document
  useEffect(() => {
    let cancelled = false;

    // Clean up previous Yjs connection
    if (yjsCleanupRef.current) {
      yjsCleanupRef.current();
      yjsCleanupRef.current = null;
    }

    if (!selectedDocument?.collaboration_id) {
      setYdoc(undefined);
      setProvider(undefined);
      setIsYjsSynced(false);
      return;
    }

    const collaborationId = selectedDocument.collaboration_id;
    const initialContent = selectedDocument.content;

    (async () => {
      try {
        const { ydoc: newYdoc, provider: newProvider } = await createYjsProvider({
          collaborationId,
          token: getStoredAuthToken() ?? undefined,
          initialContent,
        });

        if (cancelled) {
          newProvider.destroy();
          newYdoc.destroy();
          return;
        }

        setYdoc(newYdoc);
        setProvider(newProvider);
        setIsYjsSynced(newProvider.synced);

        const handleSync = (isSynced: boolean) => {
          setIsYjsSynced(isSynced);
        };
        newProvider.on('sync', handleSync);

        yjsCleanupRef.current = () => {
          newProvider.off('sync', handleSync);
          newProvider.destroy();
          newYdoc.destroy();
        };
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to create Yjs provider:', error);
          setStatus({ message: 'Collaboration connection failed.', tone: 'error' });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (yjsCleanupRef.current) {
        yjsCleanupRef.current();
        yjsCleanupRef.current = null;
      }
    };
  }, [selectedDocument?.collaboration_id]);

  // Update document state when document is selected
  useEffect(() => {
    if (!selectedDocument) {
      setDocumentName('');
      setDocumentContent('');
      hasUnsavedChangesRef.current = false;
      unsavedChangesTimestampRef.current = null;
      lastSeenSaveIdRef.current = null;
      setBlacklistedLeaderIds(new Set());
      syncedEditorKeyRef.current = -1;
      return;
    }

    // Only sync incoming document data once per explicitly initiated session
    // This prevents clobbering what the user is currently typing during renames
    if (syncedEditorKeyRef.current !== editorKey) {
      setDocumentName(stripMarkdownExtension(selectedDocument.name));
      setDocumentContent(selectedDocument.content);
      hasUnsavedChangesRef.current = false;
      unsavedChangesTimestampRef.current = null;
      lastSeenSaveIdRef.current = null;
      setBlacklistedLeaderIds(new Set());
      syncedEditorKeyRef.current = editorKey;
    }
  }, [selectedDocument, editorKey]);

  // Auto-save: content changes
  useEffect(() => {
    if (!selectedDocument || !hasUnsavedChangesRef.current) return;

    // Save Leader Election: only the client with the lowest clientID saves to the backend
    if (provider) {
      const clientIds = Array.from(provider.awareness.getStates().keys());
      const eligibleIds = clientIds.filter((id) => !blacklistedLeaderIds.has(id));
      if (eligibleIds.length > 0) {
        const leaderId = Math.min(...eligibleIds);
        if (provider.awareness.clientID !== leaderId) {
          return; // Not the leader, do not save
        }
      }
    }

    if (debouncedContent !== selectedDocument.content) {
      handleSaveDocument(debouncedContent, undefined);
    }
  }, [debouncedContent, selectedDocument, provider, blacklistedLeaderIds]);

  // Listen for awareness changes to sync save state across clients
  useEffect(() => {
    if (!provider) return;

    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().values()) as Array<{
        save?: { status: string; saveId: string };
      }>;

      const savingState = states.find((s) => s.save?.status === 'saving');
      if (savingState) {
        setStatus({ message: 'Saving...', tone: 'saving' });
        return;
      }

      const savedState = states.find((s) => s.save?.status === 'saved');
      if (
        savedState &&
        savedState.save?.saveId &&
        savedState.save.saveId !== lastSeenSaveIdRef.current
      ) {
        lastSeenSaveIdRef.current = savedState.save.saveId;
        setStatus({ message: 'Saved.', tone: 'default' });
        hasUnsavedChangesRef.current = false;
        unsavedChangesTimestampRef.current = null;
        setBlacklistedLeaderIds(new Set()); // Self-heal: clear the blacklist when any save succeeds

        setTimeout(() => {
          setStatus((prev) =>
            prev?.tone === 'default' && prev.message === 'Saved.' ? null : prev,
          );
        }, 2000);
      }
    };

    provider.awareness.on('change', handleAwarenessChange);
    return () => provider.awareness.off('change', handleAwarenessChange);
  }, [provider]);

  // Lazy-Leader Detection
  useEffect(() => {
    if (!provider) return;

    const interval = setInterval(() => {
      if (hasUnsavedChangesRef.current && unsavedChangesTimestampRef.current) {
        const timeWaiting = Date.now() - unsavedChangesTimestampRef.current;
        const states = Array.from(provider.awareness.getStates().values()) as Array<{
          save?: { status: string };
        }>;
        const isSaving = states.some((s) => s.save?.status === 'saving');

        // Give 20 seconds if someone is actively trying to save, otherwise 10 seconds
        const timeout = isSaving ? 20000 : 10000;

        if (timeWaiting > timeout) {
          const clientIds = Array.from(provider.awareness.getStates().keys());
          setBlacklistedLeaderIds((prev) => {
            const eligibleIds = clientIds.filter((id) => !prev.has(id));
            if (eligibleIds.length > 0) {
              const currentLeader = Math.min(...eligibleIds);
              if (currentLeader !== provider.awareness.clientID) {
                const next = new Set(prev);
                next.add(currentLeader);
                return next;
              }
            }
            return prev;
          });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [provider]);

  // Warn about unsaved changes on page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const createDirectoryMutation = useMutation({
    mutationFn: (path: string) => createDirectory({ path }),
    onSuccess: async () => {
      setNewDirectoryName('');
      await refreshDirectory(currentDirectory?.path ?? directoryPath, queryClient);
      setStatus({ message: 'Directory created.', tone: 'default' });
    },
    onError: (error) => setStatus({ message: getApiErrorMessage(error), tone: 'error' }),
  });

  const createDocumentMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      createDocument({ path, content }),
    onSuccess: async (res) => {
      const document = ('data' in res ? res.data : undefined) as DocumentResponse | undefined;
      if (!document) return;
      await Promise.all([
        refreshDirectory(document.parent_path, queryClient),
        queryClient.invalidateQueries({ queryKey: documentQueryKey({ path: document.path }) }),
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
    onError: (error) => {
      const message = getApiErrorMessage(error);
      if (message.toLowerCase().includes('already exists')) {
        setStatus({ message: 'A document with that name already exists.', tone: 'error' });
      } else {
        setStatus({ message, tone: 'error' });
      }
    },
  });

  const updateDirectoryMutation = useMutation({
    mutationFn: ({ path, newPath }: { path: string; newPath: string }) =>
      updateDirectory({ new_path: newPath }, { path }),
    onSuccess: async (res, variables) => {
      const directory = ('data' in res ? res.data : undefined) as DirectoryResponse | undefined;
      if (!directory) return;
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
      deleteDirectory({ path, recursive }),
    onSuccess: async (_, variables) => {
      const parentPath = getParentPath(variables.path);
      await Promise.all([
        refreshDirectory(parentPath, queryClient),
        queryClient.removeQueries({ queryKey: directoryQueryKey({ path: variables.path }) }),
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
    }) => updateDocument({ content, new_path: newPath }, { path }),
    onSuccess: async (res, variables) => {
      const document = ('data' in res ? res.data : undefined) as DocumentResponse | undefined;
      if (!document) return;
      setIsSaving(false);
      hasUnsavedChangesRef.current = false;

      // Pre-populate query cache for the new path if renamed,
      // avoiding a flash where we drop back to the explorer list on rename navigation
      if (variables.newPath && variables.newPath !== variables.path) {
        queryClient.setQueryData(documentQueryKey({ path: document.path }), res);
      }

      await Promise.all([
        refreshDirectory(document.parent_path, queryClient),
        refreshDirectory(getParentPath(variables.path), queryClient),
        queryClient.invalidateQueries({ queryKey: documentQueryKey({ path: document.path }) }),
      ]);
      if (variables.newPath && variables.newPath !== variables.path) {
        // Document was renamed, navigate to new path
        void navigate({
          replace: true,
          resetScroll: false,
          search: (previous) => ({
            ...previous,
            path: document.parent_path,
            document: document.path,
          }),
        });
      } else {
        // Only show badge when normally saving and provider is missing
        // If provider exists, awareness listener handles the UI
        if (!provider) {
          setStatus({ message: 'Saved.', tone: 'default' });
          setTimeout(
            () =>
              setStatus((prev) =>
                prev?.tone === 'default' && prev.message === 'Saved.' ? null : prev,
              ),
            2000,
          );
        }
      }
    },
    onError: (error) => {
      setIsSaving(false);
      const message = getApiErrorMessage(error);
      if (message.toLowerCase().includes('already exists')) {
        setStatus({ message: 'A document with that name already exists.', tone: 'error' });
      } else {
        setStatus({ message, tone: 'error' });
      }
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (path: string) => deleteDocument({ path }),
    onSuccess: async (_, path) => {
      const parentPath = getParentPath(path);
      await Promise.all([
        refreshDirectory(parentPath, queryClient),
        queryClient.removeQueries({ queryKey: documentQueryKey({ path }) }),
      ]);
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
    deleteDocumentMutation.isPending ||
    isSaving;

  const handleOpenDirectory = (path: string) => {
    void navigate({ search: (previous) => ({ ...previous, path, document: undefined }) });
  };

  const handleOpenDocument = (path: string) => {
    setEditorKey((prev) => prev + 1);
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

  // Find unique name for new document
  const findUniqueDocumentName = useCallback(
    (baseName: string): string => {
      if (!currentDirectory) return `${baseName}.md`;

      const names = new Set(currentDirectory.children.map((c) => c.name.toLowerCase()));
      let counter = 1;
      let candidate = `${baseName}.md`;

      while (names.has(candidate.toLowerCase())) {
        candidate = `${baseName} ${counter}.md`;
        counter++;
      }

      return candidate;
    },
    [currentDirectory],
  );

  const handleCreateDocument = () => {
    const uniqueName = findUniqueDocumentName('Untitled');
    createDocumentMutation.mutate({
      path: joinPath(directoryPath, uniqueName),
      content: '',
    });
    setEditorKey((prev) => prev + 1);
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

  const handleSaveDocument = (content?: string, newPath?: string) => {
    if (!selectedDocument) return;
    setIsSaving(true);

    let saveId: string | undefined;
    if (provider) {
      saveId = crypto.randomUUID();
      provider.awareness.setLocalStateField('save', { status: 'saving', saveId });
    } else {
      setStatus({ message: 'Saving...', tone: 'saving' });
    }

    updateDocumentMutation.mutate(
      {
        path: selectedDocument.path,
        content,
        newPath,
      },
      {
        onSuccess: () => {
          if (provider && saveId) {
            provider.awareness.setLocalStateField('save', { status: 'saved', saveId });
          }
        },
        onError: () => {
          if (provider && saveId) {
            provider.awareness.setLocalStateField('save', { status: 'error', saveId });
          }
        },
      },
    );
  };

  const handleDeleteDocument = () => {
    if (!selectedDocument) return;
    deleteDocumentMutation.mutate(selectedDocument.path);
  };

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
  }, []);

  const handleDocumentContentChange = (content: string) => {
    setDocumentContent(content);
    const isContentDirty = content !== selectedDocument?.content;
    const isNameDirty = documentName !== stripMarkdownExtension(selectedDocument?.name ?? '');

    if (isContentDirty || isNameDirty) {
      hasUnsavedChangesRef.current = true;
      unsavedChangesTimestampRef.current = Date.now(); // Always reset timer on every keystroke
    } else {
      hasUnsavedChangesRef.current = false;
      unsavedChangesTimestampRef.current = null;
      setBlacklistedLeaderIds(new Set());
    }
    if (status?.tone === 'default' || status?.tone === 'error') setStatus(null);
  };

  const handleDocumentNameChange = (name: string) => {
    setDocumentName(name);
    const isContentDirty = documentContent !== selectedDocument?.content;
    const isNameDirty = name !== stripMarkdownExtension(selectedDocument?.name ?? '');

    if (isContentDirty || isNameDirty) {
      hasUnsavedChangesRef.current = true;
      unsavedChangesTimestampRef.current = Date.now(); // Always reset timer on every keystroke
    } else {
      hasUnsavedChangesRef.current = false;
      unsavedChangesTimestampRef.current = null;
      setBlacklistedLeaderIds(new Set());
    }
    if (status?.tone === 'default' || status?.tone === 'error') setStatus(null);
  };

  const handleBackToExplorer = () => {
    void navigate({ search: (previous) => ({ ...previous, document: undefined }) });
  };

  const handleDocumentNameBlur = () => {
    if (!selectedDocument) return;
    const normalizedName = ensureMarkdownExtension(documentName);
    if (!normalizedName) {
      setDocumentName(stripMarkdownExtension(selectedDocument.name));
      return;
    }
    const newPath = joinPath(selectedDocument.parent_path, normalizedName);
    if (newPath !== selectedDocument.path) {
      handleSaveDocument(undefined, newPath);
    }
  };

  const sidebarContent = (
    <Sidebar
      breadcrumbs={breadcrumbs}
      currentPath={directoryPath}
      directoryCount={currentDirectory?.child_directories_count ?? 0}
      documentCount={currentDirectory?.child_documents_count ?? 0}
      onNavigate={handleOpenDirectory}
    />
  );

  // Editor mode loading state
  if (documentPath && (documentQuery.isPending || (selectedDocument && !isYjsSynced))) {
    return (
      <AppShell sidebar={sidebarContent}>
        <DocumentEditorSkeleton documentPath={documentPath} />
      </AppShell>
    );
  }

  // Editor mode: full window
  if (documentPath && selectedDocument && isYjsSynced) {
    return (
      <AppShell sidebar={sidebarContent}>
        <DocumentEditor
          document={selectedDocument}
          documentName={documentName}
          breadcrumbs={breadcrumbs}
          status={status}
          isBusy={isBusy}
          editorKey={editorKey}
          onBack={handleBackToExplorer}
          onNavigateToDirectory={handleOpenDirectory}
          onDocumentNameChange={handleDocumentNameChange}
          onDocumentNameBlur={handleDocumentNameBlur}
          onDocumentContentChange={handleDocumentContentChange}
          onDelete={handleDeleteDocument}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          ydoc={ydoc}
          provider={provider}
        />
      </AppShell>
    );
  }

  // Explorer mode
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
            <Button size="sm" variant="secondary" onClick={handleCreateDocument} disabled={isBusy}>
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
              {currentDirectory.children.map((node) => (
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

      {/* Inspector panel - only for directories now */}
      <InspectorPanel open={inspectorOpen} onClose={closeInspector} title="Directory controls">
        {currentDirectory && currentDirectory.path !== '/' ? (
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
    </AppShell>
  );
}

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
  await queryClient.invalidateQueries({ queryKey: directoryQueryKey({ path }) });
}
