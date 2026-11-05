/**
 * Resets authenticators from the server, for when nobody can sign in to do it on the Staff screens
 * (for example after ENCRYPTION_KEY was changed, so saved authenticators can no longer be read).
 *
 *   npm run admin:reset-mfa -- --email kofi.boateng@anu.edu.gh     one account
 *   npm run admin:reset-mfa -- --unreadable                         every authenticator the current key cannot read
 *   add --yes to skip the list-only dry run and actually reset
 *
 * Each person is signed out and sets up their authenticator again at their next sign-in.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../core/prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';
import { resetAuthenticator, unreadableAuthenticators } from '../modules/auth/mfa-reset';

function args() {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
  }
  return out;
}

async function main() {
  const a = args();
  if (!a.email && !a.unreadable) {
    console.log('Give --email <address> for one account, or --unreadable for every authenticator the current ENCRYPTION_KEY cannot read. Add --yes to reset.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const audit = app.get(AuditService);
  try {
    let targets: Array<{ userId: string; email: string | null; name: string }>;
    if (a.email) {
      const u = await prisma.user.findFirst({ where: { email: String(a.email).toLowerCase() }, select: { id: true, email: true, firstName: true, lastName: true, mfaFactor: { select: { userId: true } } } });
      if (!u) throw new Error(`No account has the email ${a.email}.`);
      if (!u.mfaFactor) { console.log(`${u.email} has no authenticator set up; nothing to reset.`); return; }
      targets = [{ userId: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` }];
    } else {
      targets = await unreadableAuthenticators(prisma);
      if (!targets.length) { console.log('Every authenticator can be read with the current ENCRYPTION_KEY; nothing to reset.'); return; }
    }
    console.log(`${targets.length} authenticator(s) to reset:`);
    for (const t of targets) console.log(`  ${t.name} <${t.email ?? 'no email'}>`);
    if (!a.yes) { console.log('\nNothing changed yet. Run again with --yes to reset these.'); return; }
    for (const t of targets) {
      const r = await resetAuthenticator(prisma, t.userId);
      await audit.record({ action: 'auth.mfa.reset', module: 'auth', targetType: 'User', targetId: t.userId, metadata: { by: 'server command', reason: a.unreadable ? 'unreadable with the current encryption key' : 'requested', sessionsEnded: r.sessionsEnded } });
    }
    console.log(`\nDone. Each person sets up their authenticator again at their next sign-in.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
