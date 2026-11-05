import type { PrismaService } from '../../core/prisma/prisma.service';
import { decrypt } from '../../core/crypto/crypto.util';

/**
 * Removes a person's authenticator and recovery codes and signs them out everywhere. Their next
 * sign-in asks them to set up an authenticator again (staff must have one).
 */
export async function resetAuthenticator(prisma: PrismaService, userId: string) {
  const [, , sessions] = await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaFactor.deleteMany({ where: { userId } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { sessionsEnded: sessions.count };
}

/** Accounts whose authenticator secret the current ENCRYPTION_KEY cannot read (the key was changed). */
export async function unreadableAuthenticators(prisma: PrismaService) {
  const factors = await prisma.mfaFactor.findMany({ select: { userId: true, secretEncrypted: true, user: { select: { email: true, firstName: true, lastName: true } } } });
  return factors.filter((f) => {
    try {
      decrypt(f.secretEncrypted);
      return false;
    } catch {
      return true;
    }
  }).map((f) => ({ userId: f.userId, email: f.user.email, name: `${f.user.firstName} ${f.user.lastName}` }));
}
