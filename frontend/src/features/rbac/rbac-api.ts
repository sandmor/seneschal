import {
  assignRoleApiAdminUsersUserIdRolesRoleIdPost,
  createRoleApiAdminRolesPost,
  createUserApiAdminUsersPost,
  deactivateUserApiAdminUsersUserIdDeactivatePatch,
  deleteRoleApiAdminRolesRoleIdDelete,
  listRolesApiAdminRolesGet,
  listUsersApiAdminUsersGet,
  revokeRoleApiAdminUsersUserIdRolesRoleIdDelete,
  updateRoleApiAdminRolesRoleIdPatch,
} from '@/api/endpoints/api';
import type {
  CreateManagedUserRequest,
  ManagedUserResponse,
  RoleRequest,
  RoleResponse,
} from '@/api/models';
import { getStoredAuthToken } from '@/features/auth/auth-api';

export type Role = RoleResponse;

export type RbacUser = {
  id: number;
  username: string;
  isActive: boolean;
  roles: Role[];
};

function authHeader(): RequestInit {
  const token = getStoredAuthToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function toRbacUser(user: ManagedUserResponse): RbacUser {
  return {
    id: user.id,
    username: user.username,
    isActive: user.is_active,
    roles: user.roles,
  };
}

export async function getRoles(): Promise<Role[]> {
  const response = await listRolesApiAdminRolesGet(authHeader());
  if (response.status !== 200) {
    throw new Error('Failed to load roles');
  }
  return response.data;
}

export async function createRole(data: RoleRequest): Promise<Role> {
  const response = await createRoleApiAdminRolesPost(data, authHeader());
  if (response.status !== 201) {
    throw new Error('Failed to create role');
  }
  return response.data;
}

export async function updateRole(id: number, data: RoleRequest): Promise<Role> {
  const response = await updateRoleApiAdminRolesRoleIdPatch(id, data, authHeader());
  if (response.status !== 200) {
    throw new Error('Failed to update role');
  }
  return response.data;
}

export async function deleteRole(id: number): Promise<void> {
  await deleteRoleApiAdminRolesRoleIdDelete(id, authHeader());
}

export async function getRbacUsers(): Promise<RbacUser[]> {
  const response = await listUsersApiAdminUsersGet(authHeader());
  if (response.status !== 200) {
    throw new Error('Failed to load users');
  }
  return response.data.map(toRbacUser);
}

export async function createUser(username: string, password: string): Promise<RbacUser> {
  const payload: CreateManagedUserRequest = { username, password };
  const response = await createUserApiAdminUsersPost(payload, authHeader());
  if (response.status !== 201) {
    throw new Error('Failed to create user');
  }
  return toRbacUser(response.data);
}

export async function updateUserRoles(userId: number, roleIds: number[]): Promise<void> {
  const existingUsers = await getRbacUsers();
  const user = existingUsers.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentRoleIds = new Set(user.roles.map((role) => role.id));
  const nextRoleIds = new Set(roleIds);

  await Promise.all(
    roleIds
      .filter((roleId) => !currentRoleIds.has(roleId))
      .map((roleId) => assignRoleApiAdminUsersUserIdRolesRoleIdPost(userId, roleId, authHeader())),
  );

  await Promise.all(
    Array.from(currentRoleIds)
      .filter((roleId) => !nextRoleIds.has(roleId))
      .map((roleId) =>
        revokeRoleApiAdminUsersUserIdRolesRoleIdDelete(userId, roleId, authHeader()),
      ),
  );
}

export async function deactivateUser(userId: number): Promise<void> {
  await deactivateUserApiAdminUsersUserIdDeactivatePatch(userId, authHeader());
}
