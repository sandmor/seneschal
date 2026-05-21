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
  onDirectoryNameChange,
  onSave,
  onDelete,
}: {
  directory: DirectoryResponse;
  directoryName: string;
  isBusy: boolean;
  onDirectoryNameChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
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
}
