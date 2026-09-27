import { Injectable } from '@nestjs/common';
import { DEVELOPER_ONLY_PERMISSIONS, ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class PermissionResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveDeveloperGrant(userId: string): Promise<boolean> {
    const now = new Date();
    const grant = await this.prisma.developerAccessGrant.findFirst({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { id: true },
    });
    return !!grant;
  }

  /** Roles the user can switch into. Developer only appears while a Super Admin grant is active. */
  async availableRoles(userId: string) {
    const now = new Date();
    const rows = await this.prisma.userRole.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { role: { select: { key: true, name: true, logGroup: true } } },
    });
    const developerActive = await this.hasActiveDeveloperGrant(userId);
    const seen = new Set<string>();
    const roles = rows.map((r) => r.role).filter((r) => r.key !== ROLE_KEYS.DEVELOPER && !seen.has(r.key) && !!seen.add(r.key));
    if (developerActive) {
      const dev = await this.prisma.role.findUnique({ where: { key: ROLE_KEYS.DEVELOPER }, select: { key: true, name: true, logGroup: true } });
      if (dev) roles.push(dev);
    }
    return roles;
  }

  /** Permissions come from the session's active role only. */
  async permissionsFor(userId: string, activeRoleKey: string | null): Promise<Set<string>> {
    if (!activeRoleKey) return new Set();
    const developerActive = await this.hasActiveDeveloperGrant(userId);

    if (activeRoleKey === ROLE_KEYS.DEVELOPER) {
      if (!developerActive) return new Set();
      const dev = await this.prisma.role.findUnique({
        where: { key: ROLE_KEYS.DEVELOPER },
        select: { permissions: { select: { permission: { select: { key: true } } } } },
      });
      return new Set(dev?.permissions.map((p) => p.permission.key) ?? []);
    }

    const now = new Date();
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, role: { key: activeRoleKey }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
    });
    const keys = new Set(userRole?.role.permissions.map((p) => p.permission.key) ?? []);
    for (const p of DEVELOPER_ONLY_PERMISSIONS) keys.delete(p);
    return keys;
  }
}
