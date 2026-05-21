import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RichEditor } from '@/features/editor/rich-editor';
import { cn } from '@/lib/utils';
import { ArrowLeftIcon, TrashIcon } from '@/features/document-browser/icons';
import type * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';

export interface Breadcrumb {
  path: string;
  label: string;
}

export interface EditorDocument {
  path: string;
  name: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  collaboration_id: string;
}

export interface DocumentEditorProps {
  document: EditorDocument;
  documentName: string;
  breadcrumbs: Breadcrumb[];
  status: {
    message: string;
    tone: 'default' | 'error' | 'saving';
  } | null;
  isBusy: boolean;
  editorKey: number;
  onBack: () => void;
  onNavigateToDirectory: (path: string) => void;
  onDocumentNameChange: (name: string) => void;
  onDocumentNameBlur: () => void;
  onDocumentContentChange: (content: string) => void;
  onDelete: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  ydoc?: Y.Doc;
  provider?: WebsocketProvider;
}

/**
 * DocumentEditor is the full-window editor for documents.
 * It includes a toolbar with navigation, breadcrumbs, name editing, and the rich editor.
 */
export function DocumentEditor({
  document,
  documentName,
  breadcrumbs,
  status,
  isBusy,
  editorKey,
  onBack,
  onNavigateToDirectory,
  onDocumentNameChange,
  onDocumentNameBlur,
  onDocumentContentChange,
  onDelete,
  onKeyDown,
  ydoc,
  provider,
}: DocumentEditorProps) {
  return (
    <>
      {/* Editor toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <span className="text-border">/</span>}
                <button
                  type="button"
                  className="hover:text-foreground truncate transition-colors"
                  onClick={() => onNavigateToDirectory(crumb.path)}
                >
                  {i === 0 ? 'Root' : crumb.label}
                </button>
              </span>
            ))}
            <span className="text-border">/</span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Input
              value={documentName}
              onChange={(e) => onDocumentNameChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={onDocumentNameBlur}
              className="h-8 w-48 lg:w-64 text-sm font-medium bg-transparent border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Untitled"
            />
            <span className="text-xs text-muted-foreground shrink-0">.md</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {status && (
            <span
              className={cn(
                'text-xs',
                status.tone === 'error'
                  ? 'text-destructive'
                  : status.tone === 'saving'
                    ? 'text-muted-foreground'
                    : 'text-primary',
              )}
            >
              {status.message}
            </span>
          )}
          <Button variant="destructive" size="sm" onClick={onDelete} disabled={isBusy}>
            <TrashIcon className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Rich Editor */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0 animate-in fade-in zoom-in-[0.99] duration-300">
        <RichEditor
          key={editorKey}
          initialContent={document.content}
          onChange={onDocumentContentChange}
          autofocus
          className="flex-1"
          ydoc={ydoc}
          provider={provider}
        />
      </div>
    </>
  );
}

/**
 * DocumentEditorSkeleton is the loading state for the document editor.
 */
export function DocumentEditorSkeleton({ documentPath }: { documentPath: string }) {
  return (
    <>
      {/* Top Header - Kept structural but disabled */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2 opacity-60 pointer-events-none transition-opacity">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="sm" className="shrink-0" tabIndex={-1}>
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <span className="text-border">/</span>
            <span className="truncate">Root</span>
            <span className="text-border">/</span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Input
              value={documentPath.split('/').pop()?.replace('.md', '') || ''}
              readOnly
              tabIndex={-1}
              className="h-8 w-48 lg:w-64 text-sm font-medium bg-transparent border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="text-xs text-muted-foreground shrink-0">.md</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="destructive" size="sm" disabled tabIndex={-1}>
            <TrashIcon className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border bg-card px-4 py-2 pointer-events-none">
        {/* Undo / Redo */}
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="h-4 w-px bg-border mx-2" />
        {/* H1, H2, H3 */}
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="h-4 w-px bg-border mx-2" />
        {/* Formatting */}
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="h-4 w-px bg-border mx-2" />
        {/* Lists */}
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="h-4 w-px bg-border mx-2" />
        {/* Indents/Others */}
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 p-8 space-y-8">
        <Skeleton className="h-10 w-1/3" /> {/* Represents an H1 Title */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
        </div>
      </div>
    </>
  );
}
