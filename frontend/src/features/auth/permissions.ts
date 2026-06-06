import type { AdminProfileResponse } from '@/api/models/adminProfileResponse';
import type { DirectoryResponse } from '@/api/models/directoryResponse';

export function isAdmin(profile: AdminProfileResponse | null | undefined): boolean {
  if (!profile) return false;
  return profile.is_superadmin || profile.permissions.includes('admin');
}

export function canWriteDirectory(directory: DirectoryResponse | null | undefined): boolean {
  return directory?.access_level === 'write';
}
