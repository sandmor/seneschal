// 🔥 MOCK API — RBAC (roles, permisos, usuarios)

export type Permission = {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
};

export type Role = {
  id: string;
  name: string;
  description: string;
  permissionIds: string[];
  createdAt: string;
};

export type RbacUser = {
  id: string;
  name: string;
  email: string;
  roleIds: string[];
};

// 🧠 Estado en memoria
const store = {
  permissions: new Map<string, Permission>([
    ['perm_1', { id: 'perm_1', name: 'documents.read', description: 'Read documents', resource: 'documents', action: 'read' }],
    ['perm_2', { id: 'perm_2', name: 'documents.create', description: 'Create documents', resource: 'documents', action: 'create' }],
    ['perm_3', { id: 'perm_3', name: 'documents.update', description: 'Edit documents', resource: 'documents', action: 'update' }],
    ['perm_4', { id: 'perm_4', name: 'documents.delete', description: 'Delete documents', resource: 'documents', action: 'delete' }],
    ['perm_5', { id: 'perm_5', name: 'roles.manage', description: 'Manage roles', resource: 'roles', action: 'manage' }],
    ['perm_6', { id: 'perm_6', name: 'users.manage', description: 'Manage users', resource: 'users', action: 'manage' }],
  ]),
  roles: new Map<string, Role>([
    ['role_1', { id: 'role_1', name: 'Admin', description: 'Full access to everything', permissionIds: ['perm_1', 'perm_2', 'perm_3', 'perm_4', 'perm_5', 'perm_6'], createdAt: '2024-01-01' }],
    ['role_2', { id: 'role_2', name: 'Editor', description: 'Can read and edit documents', permissionIds: ['perm_1', 'perm_2', 'perm_3'], createdAt: '2024-01-02' }],
    ['role_3', { id: 'role_3', name: 'Viewer', description: 'Read-only access', permissionIds: ['perm_1'], createdAt: '2024-01-03' }],
  ]),
  users: new Map<string, RbacUser>([
    ['user_1', { id: 'user_1', name: 'Santiago Morales', email: 'santiago@example.com', roleIds: ['role_1'] }],
    ['user_2', { id: 'user_2', name: 'Ana García', email: 'ana@example.com', roleIds: ['role_2'] }],
    ['user_3', { id: 'user_3', name: 'Carlos López', email: 'carlos@example.com', roleIds: ['role_3'] }],
  ]),
};

let idCounter = 100;
const newId = (prefix: string) => `${prefix}_${++idCounter}`;

// 📋 Permissions
export async function getPermissions(): Promise<Permission[]> {
  return Array.from(store.permissions.values());
}

export async function createPermission(data: Omit<Permission, 'id'>): Promise<Permission> {
  const id = newId('perm');
  const permission: Permission = { id, ...data };
  store.permissions.set(id, permission);
  return permission;
}

export async function updatePermission(id: string, data: Partial<Omit<Permission, 'id'>>): Promise<Permission> {
  const existing = store.permissions.get(id);
  if (!existing) throw new Error('Permission not found');
  const updated = { ...existing, ...data };
  store.permissions.set(id, updated);
  return updated;
}

export async function deletePermission(id: string): Promise<void> {
  store.permissions.delete(id);
  // Remove from roles too
  for (const role of store.roles.values()) {
    role.permissionIds = role.permissionIds.filter((p) => p !== id);
  }
}

// 🎭 Roles
export async function getRoles(): Promise<Role[]> {
  return Array.from(store.roles.values());
}

export async function createRole(data: Omit<Role, 'id' | 'createdAt'>): Promise<Role> {
  const id = newId('role');
  const role: Role = { id, ...data, createdAt: new Date().toISOString().split('T')[0] };
  store.roles.set(id, role);
  return role;
}

export async function updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<Role> {
  const existing = store.roles.get(id);
  if (!existing) throw new Error('Role not found');
  const updated = { ...existing, ...data };
  store.roles.set(id, updated);
  return updated;
}

export async function deleteRole(id: string): Promise<void> {
  store.roles.delete(id);
  for (const user of store.users.values()) {
    user.roleIds = user.roleIds.filter((r) => r !== id);
  }
}

// 👥 Users
export async function getRbacUsers(): Promise<RbacUser[]> {
  return Array.from(store.users.values());
}

export async function updateUserRoles(userId: string, roleIds: string[]): Promise<RbacUser> {
  const existing = store.users.get(userId);
  if (!existing) throw new Error('User not found');
  const updated = { ...existing, roleIds };
  store.users.set(userId, updated);
  return updated;
}
