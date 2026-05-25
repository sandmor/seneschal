import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  type RbacUser,
  type Role,
  createRole,
  createUser,
  deactivateUser,
  deleteRole,
  getRbacUsers,
  getRoles,
  updateRole,
  updateUserRoles,
} from '@/features/rbac/rbac-api';

type Tab = 'roles' | 'users' | 'permissions';

const PERMISSION_OPTIONS = [
  {
    value: 'files:read',
    label: 'files:read',
    description: 'View directories, documents, and collaborative sessions.',
  },
  {
    value: 'files:write',
    label: 'files:write',
    description: 'Create, edit, move, and delete files and folders.',
  },
  {
    value: 'admin',
    label: 'admin',
    description: 'Access the administration console and role management.',
  },
] as const;

type AdminConsoleProps = {
  open: boolean;
  onClose: () => void;
};

export function AdminConsole({ open, onClose }: AdminConsoleProps) {
  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<RbacUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshAll = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [roleList, userList] = await Promise.all([getRoles(), getRbacUsers()]);
      setRoles(roleList);
      setUsers(userList);
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void refreshAll();
  }, [open]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <ShieldIcon className="h-4 w-4 text-primary" />
            </span>
            <div>
              <h2 className="font-heading text-sm font-semibold text-foreground">Admin Console</h2>
              <p className="text-[10px] text-muted-foreground">Manage roles and database users</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 active:scale-[0.98] hover:bg-secondary hover:text-foreground"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-border px-6 pt-3">
          {(['roles', 'users', 'permissions'] as Tab[]).map((nextTab) => (
            <button
              key={nextTab}
              type="button"
              onClick={() => setTab(nextTab)}
              className={cn(
                'border-b-2 px-3 pb-2.5 text-xs font-medium capitalize transition-colors',
                tab === nextTab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {nextTab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {notice ? (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {notice}
            </div>
          ) : null}

          {tab === 'roles' ? (
            <RolesTab
              loading={loading}
              roles={roles}
              onRefresh={refreshAll}
              onError={(error) => setNotice(getApiErrorMessage(error))}
            />
          ) : tab === 'users' ? (
            <UsersTab
              loading={loading}
              roles={roles}
              users={users}
              onRefresh={refreshAll}
              onError={(error) => setNotice(getApiErrorMessage(error))}
            />
          ) : (
            <PermissionsTab roles={roles} />
          )}
        </div>
      </div>
    </>
  );
}

function RolesTab({
  loading,
  roles,
  onRefresh,
  onError,
}: {
  loading: boolean;
  roles: Role[];
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; permissions: string[] }>({
    name: '',
    description: '',
    permissions: [],
  });
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setForm({ name: '', description: '', permissions: [] });
    setIsCreating(true);
    setEditingRole(null);
  };

  const openEdit = (role: Role) => {
    setForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions || [],
    });
    setEditingRole(role);
    setIsCreating(false);
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingRole(null);
    setForm({ name: '', description: '', permissions: [] });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, form);
      } else {
        await createRole(form);
      }
      await onRefresh();
      closeForm();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (roleId: number) => {
    setBusy(true);
    try {
      await deleteRole(roleId);
      await onRefresh();
      closeForm();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Roles</h3>
          <p className="text-xs text-muted-foreground">{roles.length} roles configured</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={loading}>
          <PlusIcon className="h-3.5 w-3.5" />
          New role
        </Button>
      </div>

      <div className="space-y-2">
        {roles.map((role) => (
          <div
            key={role.id}
            className={cn(
              'rounded-lg border border-border bg-background p-4 transition-colors',
              editingRole?.id === role.id && 'border-primary/40 bg-primary/5',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{role.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    #{role.id}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {role.description || 'No description'}
                </p>
                {role.permissions && role.permissions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.permissions.map((perm) => (
                      <Badge key={perm} className="text-[10px] bg-primary/20 text-primary">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(role)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(role.id)}
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!loading && roles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No roles yet.
          </p>
        ) : null}
      </div>

      {isCreating || editingRole ? (
        <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h4 className="text-sm font-semibold text-foreground">
            {editingRole ? `Edit "${editingRole.name}"` : 'Create new role'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. Editor"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="What does this role cover?"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Permissions
            </label>
            <div className="flex flex-wrap gap-2">
              {PERMISSION_OPTIONS.map((permission) => {
                const isEnabled = form.permissions.includes(permission.value);

                return (
                  <button
                    key={permission.value}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        permissions: current.permissions.includes(permission.value)
                          ? current.permissions.filter((p) => p !== permission.value)
                          : [...current.permissions, permission.value],
                      }))
                    }
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      isEnabled
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                    title={permission.description}
                  >
                    {permission.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {editingRole ? 'Save changes' : 'Create role'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UsersTab({
  loading,
  roles,
  users,
  onRefresh,
  onError,
}: {
  loading: boolean;
  roles: Role[];
  users: RbacUser[];
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [editingUser, setEditingUser] = useState<RbacUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });

  const openEdit = (user: RbacUser) => {
    setEditingUser(user);
    setSelectedRoles(user.roles.map((role) => role.id));
  };

  const closeEdit = () => {
    setEditingUser(null);
    setSelectedRoles([]);
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoles((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId],
    );
  };

  const handleRoleSave = async () => {
    if (!editingUser) return;
    setBusy(true);
    try {
      await updateUserRoles(editingUser.id, selectedRoles);
      await onRefresh();
      closeEdit();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateUser = async () => {
    if (!form.username.trim() || !form.password.trim()) return;
    setBusy(true);
    try {
      await createUser(form.username, form.password);
      await onRefresh();
      setIsCreating(false);
      setForm({ username: '', password: '' });
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async (userId: number) => {
    setBusy(true);
    try {
      await deactivateUser(userId);
      await onRefresh();
      if (editingUser?.id === userId) {
        closeEdit();
      }
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Users</h3>
          <p className="text-xs text-muted-foreground">Manage database-backed user accounts</p>
        </div>
        <Button size="sm" onClick={() => setIsCreating((current) => !current)} disabled={loading}>
          <PlusIcon className="h-3.5 w-3.5" />
          New user
        </Button>
      </div>

      {isCreating ? (
        <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h4 className="text-sm font-semibold text-foreground">Create user</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Username
              </label>
              <Input
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="e.g. alice"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Temporary password"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setForm({ username: '', password: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateUser}
              disabled={busy || !form.username.trim() || !form.password.trim()}
            >
              Create user
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className={cn(
              'rounded-lg border border-border bg-background p-4 transition-colors',
              editingUser?.id === user.id && 'border-primary/40 bg-primary/5',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.username}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>User #{user.id}</span>
                      <span>•</span>
                      <span>{user.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 pl-9">
                  {user.roles.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">No roles assigned</span>
                  ) : (
                    user.roles.map((role) => (
                      <Badge key={`${user.id}-${role.id}`} className="text-[10px]">
                        {role.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(user)}
                  disabled={!user.isActive}
                >
                  Edit roles
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeactivate(user.id)}
                  disabled={busy || !user.isActive}
                >
                  Deactivate
                </Button>
              </div>
            </div>

            {editingUser?.id === user.id ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Assign roles</p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => {
                    const selected = selectedRoles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.id)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
                        )}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={closeEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleRoleSave} disabled={busy}>
                    Save
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {!loading && users.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No database users yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PermissionsTab({ roles }: { roles: Role[] }) {
  const groupedPermissions = PERMISSION_OPTIONS.map((permission) => ({
    ...permission,
    roles: roles.filter((role) => role.permissions?.includes(permission.value)),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Permissions</h3>
          <p className="text-xs text-muted-foreground">
            Roles can combine file read/write access with administration rights.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {groupedPermissions.map((permission) => (
          <div key={permission.value} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{permission.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    System
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{permission.description}</p>

                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                    Roles with this permission
                  </p>
                  {permission.roles.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground/70">None</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {permission.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="text-[10px]">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldIcon className="h-4 w-4 text-primary" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
