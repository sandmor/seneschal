import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getRoles } from '@/features/rbac/rbac-api';
import {
  type AccessKind,
  type AccessLevel,
  type AccessOverrideInput,
  deleteAccessOverride,
  listAccessOverrides,
  upsertAccessOverride,
} from '@/features/rbac/access-control-api';
import { getApiErrorMessage } from '@/lib/api-errors';

type ItemAccessControlProps = {
  path: string;
  kind: AccessKind;
  readOnly?: boolean;
};

type RoleOverrideDraft = {
  role: string;
  access: AccessLevel;
};

export function ItemAccessControl({ path, kind, readOnly }: ItemAccessControlProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const { data: overrides = [], refetch } = useQuery({
    queryKey: ['access-overrides'],
    queryFn: listAccessOverrides,
  });

  const activeOverride = overrides.find((o) => o.path === path && o.kind === kind);
  const isInheriting = !activeOverride;

  const [defaultAccess, setDefaultAccess] = useState<AccessLevel | 'inherit'>('inherit');
  const [roleOverrides, setRoleOverrides] = useState<RoleOverrideDraft[]>([]);

  useEffect(() => {
    if (activeOverride) {
      setDefaultAccess(activeOverride.default_access ?? 'inherit');
      setRoleOverrides(
        Object.entries(activeOverride.role_overrides ?? {}).map(([role, access]) => ({
          role,
          access,
        })),
      );
    } else {
      setDefaultAccess('inherit');
      setRoleOverrides([]);
    }
  }, [activeOverride]);

  const roleNames = useMemo(() => roles.map((r) => r.name).sort(), [roles]);
  const usedRoles = useMemo(() => new Set(roleOverrides.map((o) => o.role)), [roleOverrides]);
  const accessOptions: AccessLevel[] = ['none', 'read', 'write'];

  const handleAddRole = () => {
    const nextRole = roleNames.find((r) => !usedRoles.has(r));
    if (!nextRole) return;
    setRoleOverrides((curr) => [...curr, { role: nextRole, access: 'read' }]);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: AccessOverrideInput = {
        path,
        kind,
        default_access: defaultAccess === 'inherit' ? null : defaultAccess,
        role_overrides: roleOverrides.reduce(
          (acc, curr) => ({ ...acc, [curr.role]: curr.access }),
          {},
        ),
      };
      await upsertAccessOverride(payload);
      await refetch();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccessOverride(path, kind);
      await refetch();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const isChanged = () => {
    if (!activeOverride) return defaultAccess !== 'inherit' || roleOverrides.length > 0;
    if ((activeOverride.default_access ?? 'inherit') !== defaultAccess) return true;
    const existingRoles = Object.keys(activeOverride.role_overrides ?? {});
    if (existingRoles.length !== roleOverrides.length) return true;
    for (const r of roleOverrides) {
      if (activeOverride.role_overrides?.[r.role] !== r.access) return true;
    }
    return false;
  };

  return (
    <div className="space-y-4 pt-4 mt-6 border-t border-border animate-in fade-in duration-300">
      <div>
        <h4 className="font-heading text-sm font-semibold text-foreground">Access controls</h4>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Manage exceptions to inherited permissions. These settings apply recursively.
        </p>
      </div>

      {readOnly && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          You have read-only access to this item. Settings cannot be modified.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-5 shadow-sm">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            Default Access
          </label>
          <Select
            value={defaultAccess}
            onValueChange={(v) => setDefaultAccess(v as AccessLevel | 'inherit')}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Select default access" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from parent</SelectItem>
              <SelectItem value="none">None (Invisible)</SelectItem>
              <SelectItem value="read">Read-only</SelectItem>
              <SelectItem value="write">Write</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Role Access
            </label>
            {!readOnly && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleAddRole}
                disabled={roleNames.length === 0 || usedRoles.size >= roleNames.length}
              >
                Add role
              </Button>
            )}
          </div>

          {roleOverrides.length === 0 ? (
            <div className="rounded border border-dashed border-border px-4 py-3 pb-3 text-center bg-muted/30">
              <p className="text-xs italic text-muted-foreground">No role overrides specified.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {roleOverrides.map((entry, index) => (
                <div key={index} className="flex gap-2 items-center group">
                  <div className="flex-1 max-w-35">
                    <Select
                      value={entry.role}
                      onValueChange={(v) => {
                        const updated = [...roleOverrides];
                        updated[index].role = v;
                        setRoleOverrides(updated);
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleNames.map((r) => (
                          <SelectItem
                            key={r}
                            value={r}
                            disabled={usedRoles.has(r) && r !== entry.role}
                          >
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 w-24">
                    <Select
                      value={entry.access}
                      onValueChange={(v) => {
                        const updated = [...roleOverrides];
                        updated[index].access = v as AccessLevel;
                        setRoleOverrides(updated);
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessOptions.map((opt) => (
                          <SelectItem key={opt} value={opt} className="capitalize">
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      title="Remove"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                      onClick={() => {
                        setRoleOverrides(roleOverrides.filter((_, i) => i !== index));
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-4 h-4"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex gap-2 justify-end pt-3">
            {!isInheriting && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={busy}
                className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/50 transition-colors"
              >
                Reset inheritance
              </Button>
            )}
            {isChanged() && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={busy}
                className="h-8 text-xs bg-primary hover:bg-primary/90 shadow-sm"
              >
                Apply exceptions
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
