import { DocumentResponse } from '@/api/models';
import { ItemAccessControl } from '@/features/rbac/item-access-control';

export function DocumentInspector({
  document,
  readOnly,
}: {
  document: DocumentResponse;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground">{document.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{document.path}</p>
      </div>

      <ItemAccessControl path={document.path} kind="document" readOnly={readOnly} />
    </div>
  );
}
