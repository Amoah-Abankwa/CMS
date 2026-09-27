import { BadRequestException, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { PrismaService } from '../../core/prisma/prisma.service';
import { decrypt, encrypt, randomToken, sha256 } from '../../core/crypto/crypto.util';
import { RECOVERY_CODE_COUNT } from './auth.constants';

authenticator.options = { window: 1 };
const ISSUER = 'ANU Platform';
const STEP_MS = 30_000;

function formatRecovery(raw: string) {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
  return `${clean.slice(0, 5)}-${clean.slice(5, 10)}`;
}

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  async startEnrolment(userId: string, accountLabel: string) {
    const existing = await this.prisma.mfaFactor.findUnique({ where: { userId } });
    if (existing?.confirmedAt) throw new BadRequestException({ code: 'MFA_ALREADY_ENROLLED', message: 'Two-step verification is already set up.' });

    const secret = authenticator.generateSecret();
    await this.prisma.mfaFactor.upsert({
      where: { userId },
      create: { userId, secretEncrypted: encrypt(secret) },
      update: { secretEncrypted: encrypt(secret), confirmedAt: null, lastUsedStep: null },
    });
    const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
    return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }), manualKey: secret };
  }

  /** Confirms enrolment and returns recovery codes. They are shown once and stored hashed. */
  async confirmEnrolment(userId: string, code: string): Promise<string[]> {
    const factor = await this.prisma.mfaFactor.findUnique({ where: { userId } });
    if (!factor || factor.confirmedAt) throw new BadRequestException({ code: 'MFA_NOT_STARTED', message: 'Start setup again.' });
    const step = this.check(decrypt(factor.secretEncrypted), code, factor.lastUsedStep);
    if (step === null) throw new BadRequestException({ code: 'MFA_CODE_INVALID', message: 'That code is not valid. Check your authenticator app and try again.' });

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => formatRecovery(randomToken(12)));
    await this.prisma.$transaction([
      this.prisma.mfaFactor.update({ where: { userId }, data: { confirmedAt: new Date(), lastUsedStep: BigInt(step) } }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256(c) })) }),
    ]);
    return codes;
  }

  /** Accepts a TOTP code or an unused recovery code. Returns the method used, or null. */
  async verify(userId: string, code: string): Promise<'totp' | 'recovery' | null> {
    const factor = await this.prisma.mfaFactor.findUnique({ where: { userId } });
    if (!factor?.confirmedAt) return null;

    if (/^\d{6}$/.test(code)) {
      const step = this.check(decrypt(factor.secretEncrypted), code, factor.lastUsedStep);
      if (step === null) return null;
      await this.prisma.mfaFactor.update({ where: { userId }, data: { lastUsedStep: BigInt(step) } });
      return 'totp';
    }

    const hash = sha256(formatRecovery(code));
    const used = await this.prisma.recoveryCode.updateMany({ where: { userId, codeHash: hash, usedAt: null }, data: { usedAt: new Date() } });
    return used.count === 1 ? 'recovery' : null;
  }

  isEnrolled(userId: string) {
    return this.prisma.mfaFactor.findFirst({ where: { userId, confirmedAt: { not: null } }, select: { id: true } }).then(Boolean);
  }

  /** Returns the accepted time step, rejecting reuse of a code already used. */
  private check(secret: string, code: string, lastUsedStep: bigint | null): number | null {
    const delta = authenticator.checkDelta(code, secret);
    if (delta === null) return null;
    const step = Math.floor(Date.now() / STEP_MS) + delta;
    if (lastUsedStep !== null && BigInt(step) <= lastUsedStep) return null;
    return step;
  }
}
