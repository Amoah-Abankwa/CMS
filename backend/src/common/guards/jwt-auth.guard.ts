import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLE_LOG_GROUP, RoleKey } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RequestContext } from '../../core/context/request-context';
import { loadEnv } from '../../core/config/env';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ACCESS_COOKIE } from '../../modules/auth/auth.constants';
import type { AccessTokenPayload } from '../../modules/auth/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token: string | undefined = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Sign in to continue.' });

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: loadEnv().JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Your session has expired.' });
    }
    if (payload.typ !== 'access') throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid session.' });

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { id: true, type: true, status: true, firstName: true, lastName: true, indexNumber: true, email: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'SESSION_REVOKED', message: 'Your session has ended. Sign in again.' });
    }
    // Staff and partners must have completed MFA for this session.
    if (session.user.type !== 'STUDENT' && !session.mfaVerifiedAt) {
      throw new UnauthorizedException({ code: 'MFA_REQUIRED', message: 'Complete two-step verification.' });
    }

    const u = session.user;
    const label = `${u.firstName} ${u.lastName} (${u.indexNumber ?? u.email})`;
    req.user = {
      id: u.id,
      sessionId: session.id,
      type: u.type,
      activeRoleKey: session.activeRoleKey,
      mfaVerifiedAt: session.mfaVerifiedAt,
      label,
    };
    RequestContext.patch({
      userId: u.id,
      userLabel: label,
      activeRoleKey: session.activeRoleKey ?? undefined,
      logGroup: session.activeRoleKey ? ROLE_LOG_GROUP[session.activeRoleKey as RoleKey] : undefined,
    });
    return true;
  }
}
