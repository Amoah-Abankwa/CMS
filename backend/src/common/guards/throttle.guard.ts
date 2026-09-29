import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Request limits counted per person, not per address. Many students share the campus's public IP
 * address, so counting by address alone would let one busy lecture hall use up everyone's allowance.
 * Signed-in requests are counted by account; sign-in pages by address and the account being tried, so
 * students on the same network do not block each other while guessing at one account stays limited.
 * Runs after JwtAuthGuard, so the account is known.
 */
@Injectable()
export class PerPersonThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    if (user?.id) return `u:${user.id}`;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const who = String(body.indexNumber ?? body.email ?? body.identifier ?? '').trim().toLowerCase().slice(0, 120);
    return who ? `ip:${String(req.ip)}:${who}` : `ip:${String(req.ip)}`;
  }
}
