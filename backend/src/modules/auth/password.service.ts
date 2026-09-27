import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

// A short built-in list; replace with a larger breached-password list file in production.
const COMMON = new Set([
  'password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou123',
  'allnations', 'allnations1', 'anu12345678', 'welcome123', 'administrator', 'letmein1234',
]);

@Injectable()
export class PasswordService {
  hash(plain: string) {
    return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  async verify(hash: string, plain: string) {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  assertPolicy(plain: string, context: string[] = []) {
    const lower = plain.toLowerCase();
    if (plain.length < 10) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Use at least 10 characters.' });
    if (COMMON.has(lower)) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'This password is too common. Choose another.' });
    if (context.some((c) => c && c.length >= 4 && lower.includes(c.toLowerCase()))) {
      throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Your password cannot contain your name, email or index number.' });
    }
  }
}
