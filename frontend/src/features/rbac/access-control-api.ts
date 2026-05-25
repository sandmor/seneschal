import {
  deleteOverrideApiAdminAccessControlDelete,
  listOverridesApiAdminAccessControlGet,
  upsertOverrideApiAdminAccessControlPut,
} from '@/api/endpoints/api';
import type {
  AccessLevel as AccessLevelModel,
  AccessOverrideRequest,
  AccessOverrideResponse,
  NodeKind,
} from '@/api/models';
import { getStoredAuthToken } from '@/features/auth/auth-api';

export type AccessKind = NodeKind;
export type AccessLevel = AccessLevelModel;
export type AccessOverride = AccessOverrideResponse;
export type AccessOverrideInput = AccessOverrideRequest;

function authHeader(): RequestInit {
  const token = getStoredAuthToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export async function listAccessOverrides(): Promise<AccessOverride[]> {
  const response = await listOverridesApiAdminAccessControlGet(authHeader());
  if (response.status !== 200) {
    throw new Error('Failed to load access overrides');
  }
  return response.data;
}

export async function upsertAccessOverride(payload: AccessOverrideInput): Promise<AccessOverride> {
  const response = await upsertOverrideApiAdminAccessControlPut(payload, authHeader());
  if (response.status !== 200) {
    throw new Error('Failed to save access override');
  }
  return response.data;
}

export async function deleteAccessOverride(path: string, kind: AccessKind): Promise<void> {
  await deleteOverrideApiAdminAccessControlDelete({ path, kind }, authHeader());
}
