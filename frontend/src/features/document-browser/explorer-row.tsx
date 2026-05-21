import { DirectoryNodeResponse, DocumentNodeResponse } from '@/api/models';

type ExplorerNode = DirectoryNodeResponse | DocumentNodeResponse;
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * ExplorerRow represents a single row in the file list.
 */
export function ExplorerRow({
  node,
  isSelected,
  onSelect,
}: {
  node: ExplorerNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
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
}

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
