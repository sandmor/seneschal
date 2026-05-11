import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Permission,
  Role,
  RbacUser,
  getPermissions,
  getRoles,
  getRbacUsers,
  createPermission,
  updatePermission,
  deletePermission,
  createRole,
  updateRole,
  deleteRole,
  updateUserRoles,
} from '@/features/rbac/rbac-api';

type Tab = 'roles' | 'permissions' | 'users';

type AdminConsoleProps = {
  open: boolean;
  onClose: () => void;
};

export function AdminConsole({ open, onClose }: AdminConsoleProps) {
  const [tab, setTab] = useState<Tab>('roles');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<RbacUser[]>([]);

  useEffect(() => {
    if (!open) return;
    void getPermissions().then(setPermissions);
    void getRoles().then(setRoles);
    void getRbacUsers().then(setUsers);
  }, [open]);

  const refreshAll = async () => {
    const [p, r, u] = await Promise.all([getPermissions(), getRoles(), getRbacUsers()]);
    setPermissions(p);
    setRoles(r);
    setUsers(u);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <ShieldIcon className="h-4 w-4 text-primary" />
            </span>
            <div>
              <h2 className="font-heading text-sm font-semibold text-foreground">Admin Console</h2>
              <p className="text-[10px] text-muted-foreground">Roles, permissions & access control</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </header>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-border px-6 pt-3">
          {(['roles', 'permissions', 'users'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-3 pb-2.5 text-xs font-medium capitalize transition-colors border-b-2',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'roles' && (
            <RolesTab roles={roles} permissions={permissions} onRefresh={refreshAll} />
          )}
          {tab === 'permissions' && (
            <PermissionsTab permissions={permissions} onRefresh={refreshAll} />
          )}
          {tab === 'users' && (
            <UsersTab users={users} roles={roles} onRefresh={refreshAll} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────

function RolesTab({ roles, permissions, onRefresh }: { roles: Role[]; permissions: Permission[]; onRefresh: () => Promise<void> }) {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissionIds: [] as string[] });
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setForm({ name: '', description: '', permissionIds: [] });
    setIsCreating(true);
    setEditingRole(null);
  };

  const openEdit = (role: Role) => {
    setForm({ name: role.name, description: role.description, permissionIds: [...role.permissionIds] });
    setEditingRole(role);
    setIsCreating(false);
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingRole(null);
  };

  const togglePermission = (permId: string) => {
    setForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(permId)
        ? f.permissionIds.filter((p) => p !== permId)
        : [...f.permissionIds, permId],
    }));
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
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteRole(id);
      await onRefresh();
      closeForm();
    } finally {
      setBusy(false);
    }
  };

  const groupedPerms = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Roles</h3>
          <p className="text-xs text-muted-foreground">{roles.length} roles configured</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="h-3.5 w-3.5" />
          New role
        </Button>
      </div>

      {/* Role list */}
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
                  <span className="text-[10px] text-muted-foreground">{role.createdAt}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {role.permissionIds.slice(0, 4).map((pid) => {
                    const perm = permissions.find((p) => p.id === pid);
                    return perm ? (
                      <Badge key={pid} className="text-[10px]">{perm.name}</Badge>
                    ) : null;
                  })}
                  {role.permissionIds.length > 4 && (
                    <Badge className="text-[10px]">+{role.permissionIds.length - 4} more</Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(role)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(role.id)} disabled={busy}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {(isCreating || editingRole) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">
            {editingRole ? `Edit "${editingRole.name}"` : 'Create new role'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Editor" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What can this role do?" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Permissions</label>
            <div className="space-y-3">
              {Object.entries(groupedPerms).map(([resource, perms]) => (
                <div key={resource}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{resource}</p>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((perm) => {
                      const selected = form.permissionIds.includes(perm.id);
                      return (
                        <button
                          key={perm.id}
                          type="button"
                          onClick={() => togglePermission(perm.id)}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-xs transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
                          )}
                        >
                          {perm.action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeForm}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {editingRole ? 'Save changes' : 'Create role'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────

const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

function PermissionsTab({ permissions, onRefresh }: { permissions: Permission[]; onRefresh: () => Promise<void> }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);
  const [form, setForm] = useState({ name: '', description: '', resource: '', action: 'read' as Permission['action'] });
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setForm({ name: '', description: '', resource: '', action: 'read' });
    setIsCreating(true);
    setEditingPerm(null);
  };

  const openEdit = (perm: Permission) => {
    setForm({ name: perm.name, description: perm.description, resource: perm.resource, action: perm.action });
    setEditingPerm(perm);
    setIsCreating(false);
  };

  const closeForm = () => { setIsCreating(false); setEditingPerm(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.resource.trim()) return;
    setBusy(true);
    try {
      if (editingPerm) {
        await updatePermission(editingPerm.id, form);
      } else {
        await createPermission(form);
      }
      await onRefresh();
      closeForm();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deletePermission(id);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Permissions</h3>
          <p className="text-xs text-muted-foreground">{permissions.length} permissions defined</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="h-3.5 w-3.5" />
          New permission
        </Button>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([resource, perms]) => (
          <div key={resource}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{resource}</p>
            <div className="overflow-hidden rounded-lg border border-border">
              {perms.map((perm, i) => (
                <div
                  key={perm.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-2.5',
                    i > 0 && 'border-t border-border',
                    editingPerm?.id === perm.id && 'bg-primary/5',
                  )}
                >
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{perm.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{perm.description}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-medium',
                      perm.action === 'manage' ? 'bg-destructive/10 text-destructive' :
                      perm.action === 'delete' ? 'bg-orange-500/10 text-orange-600' :
                      'bg-primary/10 text-primary',
                    )}>{perm.action}</span>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(perm)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(perm.id)} disabled={busy}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(isCreating || editingPerm) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            {editingPerm ? `Edit permission` : 'New permission'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="documents.read" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Resource</label>
              <Input value={form.resource} onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value }))} placeholder="documents" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as Permission['action'] }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
              >
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What does this allow?" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeForm}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {editingPerm ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users, roles, onRefresh }: { users: RbacUser[]; roles: Role[]; onRefresh: () => Promise<void> }) {
  const [editingUser, setEditingUser] = useState<RbacUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const openEdit = (user: RbacUser) => {
    setEditingUser(user);
    setSelectedRoles([...user.roleIds]);
  };

  const closeEdit = () => { setEditingUser(null); setSelectedRoles([]); };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setBusy(true);
    try {
      await updateUserRoles(editingUser.id, selectedRoles);
      await onRefresh();
      closeEdit();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-semibold text-foreground">Users</h3>
        <p className="text-xs text-muted-foreground">Assign roles to users</p>
      </div>

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
                    {user.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 pl-9">
                  {user.roleIds.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">No roles assigned</span>
                  )}
                  {user.roleIds.map((rid) => {
                    const role = roles.find((r) => r.id === rid);
                    return role ? <Badge key={rid} className="text-[10px]">{role.name}</Badge> : null;
                  })}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>Edit roles</Button>
            </div>

            {editingUser?.id === user.id && (
              <div className="mt-4 border-t border-border pt-4 space-y-3">
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
                  <Button variant="ghost" size="sm" onClick={closeEdit}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={busy}>Save</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
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
