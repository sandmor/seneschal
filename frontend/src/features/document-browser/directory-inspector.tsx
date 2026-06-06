import { ItemAccessControl } from '@/features/rbac/item-access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DirectoryResponse } from '@/api/models';

/**
 * DirectoryInspector is the component shown in the inspector panel when a directory is selected.
 */
export function DirectoryInspector({
  directory,
  directoryName,
  isBusy,
  readOnly,
  showAccessControl,
  onDirectoryNameChange,
  onSave,
  onDelete,
}: {
  directory: DirectoryResponse;
  directoryName: string;
  isBusy: boolean;
  readOnly?: boolean;
  showAccessControl?: boolean;
  onDirectoryNameChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const isRoot = directory.path === '/';
  const isReadOnly = readOnly || isRoot;

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
          disabled={isReadOnly}
          placeholder="archive-branch"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {isRoot
            ? 'Root cannot be renamed or deleted.'
            : isReadOnly
              ? 'You have read-only access to this directory.'
              : 'Rename or delete this directory below.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onSave} disabled={isBusy || isReadOnly}>
          Save
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isBusy || isReadOnly}>
          Delete
        </Button>
      </div>
      {showAccessControl && (
        <ItemAccessControl path={directory.path} kind="directory" readOnly={isReadOnly} />
      )}
    </div>
  );
}
