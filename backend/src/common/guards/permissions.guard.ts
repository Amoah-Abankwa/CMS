import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@anu/shared';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { RECENT_MFA_KEY } from '../decorators/require-recent-mfa.decorator';
import { PermissionResolverService } from '../../modules/rbac/permission-resolver.service';
import type { AuthUser } from '../decorators/current-user.decorator';

const STEP_UP_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, targets) ?? [];
    const needsRecentMfa = this.reflector.getAllAndOverride<boolean>(RECENT_MFA_KEY, targets) ?? false;
    if (!required.length && !needsRecentMfa) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have access to this action.' });

    if (required.length) {
      const granted = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
      const missing = required.filter((p) => !granted.has(p));
      if (missing.length) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have access to this action.' });
      }
    }

    if (needsRecentMfa) {
      const fresh = user.mfaVerifiedAt && Date.now() - user.mfaVerifiedAt.getTime() < STEP_UP_WINDOW_MS;
      if (!fresh) {
        throw new ForbiddenException({ code: 'STEP_UP_REQUIRED', message: 'Confirm your authenticator code to continue.' });
      }
    }
    return true;
  }
}
