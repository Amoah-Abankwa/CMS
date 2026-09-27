import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@anu/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
/** The signed-in user's active role must hold every listed permission. */
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
