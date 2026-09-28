/**
 * Creates a Super Admin account on a fresh (production) database and emails them a setup link. The
 * person chooses their own password and sets up their authenticator; no password is ever printed.
 *
 *   pnpm admin:create --email kofi.boateng@anu.edu.gh --first Kofi --last Boateng --staff-number ICT-0001 [--phone 0244000000]
 *
 * Refuses if an active Super Admin already exists, unless --force is given (for a second admin, use
 * the Staff screens instead, so the action is made by a signed-in person and logged against them).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ROLE_KEYS } from '@anu/shared';
import { AppModule } from '../app.module';
import { PrismaService } from '../core/prisma/prisma.service';
import { normaliseGhanaPhone } from '../core/sms/sms.provider';
import { AccountSetupService } from '../modules/account-setup/account-setup.service';
import { AuditService } from '../modules/audit/audit.service';

function args() {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

async function main() {
  const a = args();
  const email = String(a.email ?? '').trim().toLowerCase();
  const first = String(a.first ?? '').trim();
  const last = String(a.last ?? '').trim();
  const staffNumber = String(a['staff-number'] ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !first || !last || !staffNumber) {
    console.error('Usage: pnpm admin:create --email <address> --first <first name> --last <last name> --staff-number <number> [--phone <number>] [--force]');
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const prisma = app.get(PrismaService);
    const existing = await prisma.userRole.count({ where: { role: { key: ROLE_KEYS.SUPER_ADMIN }, user: { status: 'ACTIVE' } } });
    if (existing && !a.force) {
      console.error(`There is already ${existing === 1 ? 'an active Super Admin' : `${existing} active Super Admins`}. Add further admins from the Staff screens, or pass --force.`);
      process.exitCode = 1;
      return;
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      console.error(`An account with ${email} already exists.`);
      process.exitCode = 1;
      return;
    }
    const role = await prisma.role.findUnique({ where: { key: ROLE_KEYS.SUPER_ADMIN } });
    if (!role) {
      console.error('Roles are missing. Run the production seed first: NODE_ENV=production pnpm db:seed');
      process.exitCode = 1;
      return;
    }
    const user = await prisma.user.create({
      data: {
        type: 'STAFF', status: 'PENDING_SETUP', email, firstName: first, lastName: last,
        phone: a.phone ? normaliseGhanaPhone(String(a.phone)) : null, primaryRoleKey: ROLE_KEYS.SUPER_ADMIN,
        staffProfile: { create: { staffNumber } },
        roles: { create: { roleId: role.id } },
      },
    });
    await app.get(AuditService).record({
      action: 'staff.created', module: 'staff', targetType: 'User', targetId: user.id,
      actor: { id: user.id, label: 'Command line (admin:create)', roleKey: null },
      after: { email, role: ROLE_KEYS.SUPER_ADMIN, via: 'admin:create' },
    });
    await app.get(AccountSetupService).sendSetupLink(user.id);
    console.log(`Created Super Admin ${first} ${last} <${email}>. A setup link has been emailed; it lets them choose a password and set up their authenticator.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
