import { Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RequestContext } from '../../core/context/request-context';
import { loadEnv } from '../../core/config/env';
import { randomToken, sha256 } from '../../core/crypto/crypto.util';
import { AuditService } from '../audit/audit.service';
import { TokenService } from './token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, activeRoleKey: string | null, mfaVerified: boolean): Promise<IssuedTokens> {
    const ctx = RequestContext.get();
    const secret = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        activeRoleKey,
        refreshTokenHash: sha256(secret),
        mfaVerifiedAt: mfaVerified ? new Date() : null,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        expiresAt: new Date(Date.now() + loadEnv().REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
    return { accessToken: await this.tokens.signAccess(userId, session.id), refreshToken: `${session.id}.${secret}` };
  }

  /** Rotates the refresh token. Reusing an old token revokes the session (possible theft). */
  async refresh(raw: string | undefined): Promise<IssuedTokens> {
    const invalid = () => new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Your session has ended. Sign in again.' });
    if (!raw || !raw.includes('.')) throw invalid();
    const [sessionId, secret] = raw.split('.', 2);
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: { select: { status: true } } } }).catch(() => null);
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') throw invalid();

    const presented = Buffer.from(sha256(secret));
    const stored = Buffer.from(session.refreshTokenHash);
    if (presented.length !== stored.length || !timingSafeEqual(presented, stored)) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await this.audit.record({
        action: 'auth.refresh.reuse_detected',
        module: 'auth',
        result: 'FAILURE',
        targetType: 'Session',
        targetId: session.id,
        actor: { id: session.userId, label: 'Session owner', roleKey: session.activeRoleKey },
      });
      throw invalid();
    }

    const next = randomToken();
    await this.prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: sha256(next), lastSeenAt: new Date() } });
    return { accessToken: await this.tokens.signAccess(session.userId, session.id), refreshToken: `${session.id}.${next}` };
  }

  revoke(sessionId: string) {
    return this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  revokeAllExcept(userId: string, keepSessionId?: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  listActive(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastSeenAt: true, activeRoleKey: true },
    });
  }
}
