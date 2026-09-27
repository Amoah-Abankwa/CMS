/**
 * End-to-end smoke test against a running API with the demo data loaded (pnpm db:seed).
 * It signs in as demo accounts (generating authenticator codes like a phone app would), opens the
 * main screen of every role, checks that people are refused what is not theirs, and runs one food
 * order from checkout to doorstep with a campus dispatcher.
 *
 *   pnpm dev                                  (in another terminal)
 *   npx tsx scripts/qa/smoke.ts               (or: pnpm qa:smoke)
 *
 * Settings: SMOKE_API (default http://localhost:4000/api/v1), SMOKE_DELAY_MS (default 550; the API
 * allows 120 requests a minute from one address, so requests are spaced out).
 *
 * The food order changes data (it creates and completes one order). Re-seed for a clean demo.
 */
import { base32Decode, totp } from './totp';

const API = process.env.SMOKE_API ?? 'http://localhost:4000/api/v1';
const DELAY = Number(process.env.SMOKE_DELAY_MS ?? 550);
const PASSWORD = 'AnuDemo#2025';
const TOTP_KEY = base32Decode('KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD');

type Result = { name: string; ok: boolean; detail?: string; skipped?: boolean };
const results: Result[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  private cookies = new Map<string, string>();
  constructor(readonly label: string) {}

  async call(method: string, path: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    await sleep(DELAY);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.csrf !== false) headers['x-anu-client'] = 'web';
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const text = await res.text();
    let data: any = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { status: res.status, data };
  }
}

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail && !ok ? `\n      ${detail}` : ''}`);
}
function skip(name: string, why: string) {
  results.push({ name, ok: true, skipped: true, detail: why });
  console.log(`skip  ${name}: ${why}`);
}
const list = (d: unknown): any[] => (Array.isArray(d) ? d : []);
const brief = (d: unknown) => (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 200);

async function expectStatus(c: Client, method: string, path: string, want: number | number[], name?: string, body?: unknown) {
  const r = await c.call(method, path, body);
  const wants = Array.isArray(want) ? want : [want];
  record(name ?? `${c.label}: ${method} ${path} -> ${wants.join('/')}`, wants.includes(r.status), `got ${r.status}: ${brief(r.data)}`);
  return r;
}

async function student(index: string) {
  const c = new Client(index);
  const r = await c.call('POST', '/auth/student/login', { indexNumber: index, password: PASSWORD });
  record(`${index}: student sign-in`, r.status < 300, `got ${r.status}: ${brief(r.data)}`);
  return c;
}

async function staff(email: string) {
  const c = new Client(email.split('@')[0]);
  const r = await c.call('POST', '/auth/staff/login', { email, password: PASSWORD });
  if (r.status >= 300 || r.data?.status !== 'mfa_required') {
    record(`${c.label}: staff sign-in (password step)`, false, `got ${r.status}: ${brief(r.data)}`);
    return c;
  }
  const v = await c.call('POST', '/auth/mfa/verify', { challengeToken: r.data.challengeToken, code: totp(TOTP_KEY) });
  record(`${c.label}: staff sign-in with authenticator code`, v.status < 300, `got ${v.status}: ${brief(v.data)}`);
  return c;
}

/** Each role's main screens load. */
const ROLE_SCREENS: Array<[string, string[]]> = [
  ['superadmin@demo.anu.edu.gh', ['/audit', '/staff', '/audit/groups']],
  ['registrar@demo.anu.edu.gh', ['/academics/semesters', '/students', '/grading/scale', '/results/sheets']],
  ['exams@demo.anu.edu.gh', ['/exams/timetable', '/exams/eligibility', '/exams/venues']],
  ['lecturer.cs@demo.anu.edu.gh', ['/teaching/classes']],
  ['finance@demo.anu.edu.gh', ['/exams/clearance', '/marketplace/vendors']],
  ['deanofstudents@demo.anu.edu.gh', ['/exams/holds', '/attendance/excuses', '/employment/dispatchers']],
  ['health@demo.anu.edu.gh', ['/attendance/excuses']],
  ['chaplaincy@demo.anu.edu.gh', ['/devotion/services', '/devotion/scores']],
  ['hostels@demo.anu.edu.gh', ['/hostels', '/hostels/applications']],
  ['librarian@demo.anu.edu.gh', ['/library/overdue', '/library/fines', '/library/stats']],
  ['libdesk@demo.anu.edu.gh', ['/library/holds']],
  ['careers@demo.anu.edu.gh', ['/employment/jobs', '/employment/dispatchers', '/employment/rules']],
  ['ict@demo.anu.edu.gh', ['/notifications/failed']],
  ['auditor@demo.anu.edu.gh', ['/audit']],
  ['owner@demo.anu.edu.gh', ['/my-hostels']],
  ['vendor@demo.anu.edu.gh', ['/vendor', '/vendor/orders']],
];
const STUDENT_SCREENS = ['/auth/me', '/me/registration', '/me/results', '/me/attendance', '/me/devotion', '/me/exams', '/me/accommodation', '/me/library', '/food/vendors', '/me/work/jobs', '/me/work/dispatcher', '/notifications'];

async function main() {
  console.log(`Smoke test against ${API}\n`);
  const anon = new Client('anonymous');
  const h = await anon.call('GET', '/health').catch((err: Error & { cause?: { code?: string } }) => ({ status: 0, data: err.cause?.code ?? err.message }));
  if (h.status !== 200) {
    console.log(`The API is not answering at ${API} (${h.status ? `status ${h.status}` : h.data}). Start it with pnpm dev, or set SMOKE_API.`);
    process.exit(2);
  }
  record('API health check', true);

  // ---- Refusals: signed out, wrong kind of account, missing CSRF header ----
  await expectStatus(anon, 'GET', '/auth/me', 401, 'Signed out: /auth/me is refused');
  const s1 = await student('ANU25400001');
  for (const p of STUDENT_SCREENS) await expectStatus(s1, 'GET', p, 200);
  await expectStatus(s1, 'GET', '/employment/jobs', 403, 'Student cannot open Career Services screens');
  await expectStatus(s1, 'GET', '/marketplace/settlements?from=2026-09-01T00:00:00Z&to=2026-09-30T00:00:00Z', 403, 'Student cannot see vendor settlements');
  await expectStatus(s1, 'GET', '/dispatch', 403, 'A student who is not a dispatcher cannot open deliveries');
  const noCsrf = await s1.call('POST', '/notifications/read-all', {}, { csrf: false });
  record('A write without the web client header is refused (CSRF protection)', noCsrf.status === 403, `got ${noCsrf.status}`);

  // ---- Every staff role signs in with an authenticator code and opens its screens ----
  const clients = new Map<string, Client>();
  for (const [email, paths] of ROLE_SCREENS) {
    const c = await staff(email);
    clients.set(email, c);
    for (const p of paths) await expectStatus(c, 'GET', p, 200);
  }
  await expectStatus(clients.get('vendor@demo.anu.edu.gh')!, 'GET', '/employment/jobs', 403, 'Vendor cannot open Career Services screens');
  await expectStatus(clients.get('superadmin@demo.anu.edu.gh')!, 'GET', '/exams/clearance', 403, 'Super Admin cannot make fee-clearance decisions');

  // ---- Employment: CGPA is checked for applicants ----
  const careers = clients.get('careers@demo.anu.edu.gh')!;
  const jobs = await careers.call('GET', '/employment/jobs');
  const ict = Array.isArray(jobs.data) ? jobs.data.find((j: any) => j.title === 'ICT help desk assistant') : null;
  if (!ict) record('Demo job "ICT help desk assistant" exists', false, brief(jobs.data));
  else {
    const d = await careers.call('GET', `/employment/jobs/${ict.id}`);
    const apps = d.data?.applications ?? [];
    record('Applicants show a CGPA and an eligibility decision', apps.length > 0 && apps.every((a: any) => 'cgpa' in a && typeof a.eligibility?.eligible === 'boolean'), brief(apps[0]));
  }

  // ---- A food order delivered by a campus dispatcher ----
  const customer = await student('ANU25400002');
  const vendors = await customer.call('GET', '/food/vendors');
  const cafeteria = list(vendors.data).find((v: any) => v.name === 'ANU Main Cafeteria');
  if (!cafeteria) record('Demo vendor ANU Main Cafeteria is listed', false, brief(vendors.data));
  else if (!cafeteria.openNow) skip('Food order with a campus dispatcher', 'the cafeteria is closed right now (Mon-Fri 07:00-21:00, Sat 09:00-18:00 Ghana time); run again in opening hours');
  else {
    const menu = await customer.call('GET', `/food/vendors/${cafeteria.id}`);
    const item = list(menu.data?.items).find((i: any) => i.isAvailable);
    if (!item) {
      record('The cafeteria menu has an available dish', false, `got ${menu.status}: ${brief(menu.data)}`);
      return finish();
    }
    const quantity = Math.max(1, Math.ceil(menu.data.minimumOrder / item.price));
    const placed = await customer.call('POST', '/food/orders', { vendorId: cafeteria.id, lines: [{ menuItemId: item.id, quantity }], fulfilment: 'DELIVERY', paymentOption: 'ONLINE', deliveryAddress: 'Grace Hall, room G14' });
    record('Customer places a delivery order and is sent to pay', placed.status === 201 && !!placed.data?.paymentUrl, `got ${placed.status}: ${brief(placed.data)}`);
    const orderId = placed.data?.orderId;
    const reference = placed.data?.paymentUrl ? new URL(placed.data.paymentUrl).searchParams.get('reference') : null;
    const cash = await customer.call('POST', '/food/orders', { vendorId: cafeteria.id, lines: [{ menuItemId: item.id, quantity }], fulfilment: 'DELIVERY', paymentOption: 'ON_PICKUP', deliveryAddress: 'Grace Hall' });
    record('Cash on delivery is refused when campus dispatchers deliver', cash.status === 400, `got ${cash.status}: ${brief(cash.data)}`);

    if (orderId && reference) {
      const paid = await customer.call('POST', `/payments/${reference}/demo`, { outcome: 'success' });
      record('Demo payment succeeds and is confirmed by the server', paid.data?.status === 'SUCCEEDED', `got ${paid.status}: ${brief(paid.data)}`);
      const vendor = clients.get('vendor@demo.anu.edu.gh')!;
      const board = await vendor.call('GET', '/vendor/orders');
      const onBoard = list(board.data?.active).find((o: any) => o.id === orderId);
      record('The paid order appears on the vendor board', !!onBoard, brief(list(board.data?.active).map((o: any) => o.number)));
      record("The vendor board does not show the customer's code", onBoard && onBoard.pickupCode === undefined, brief(onBoard));

      const other = await staff('vendor2@demo.anu.edu.gh');
      await expectStatus(other, 'POST', `/vendor/orders/${orderId}/action`, 403, "Another vendor cannot act on this vendor's order", { to: 'ACCEPTED' });

      await expectStatus(vendor, 'POST', `/vendor/orders/${orderId}/action`, 200, 'Vendor accepts the order', { to: 'ACCEPTED' });
      await expectStatus(vendor, 'POST', `/vendor/orders/${orderId}/action`, 200, 'Vendor marks it ready for a dispatcher', { to: 'READY' });
      await expectStatus(vendor, 'POST', `/vendor/orders/${orderId}/action`, 409, 'Vendor cannot complete it while it is with the dispatcher pool', { to: 'COMPLETED', code: '0000' });

      const rider = await student('ANU26400006');
      await expectStatus(rider, 'POST', '/dispatch/online', 200, 'Dispatcher goes online', { online: true });
      const state = await rider.call('GET', '/dispatch');
      const offer = list(state.data?.available).find((a: any) => a.number === placed.data.number);
      record('The delivery is offered, showing only the hall', !!offer && offer.area === 'Grace Hall', brief(state.data?.available));
      if (offer) {
        await expectStatus(rider, 'POST', `/dispatch/deliveries/${offer.id}/take`, 200, 'Dispatcher takes the delivery');
        await expectStatus(rider, 'POST', `/dispatch/deliveries/${offer.id}/picked-up`, 200, 'Dispatcher collects it');
        const tracked = await customer.call('GET', `/food/orders/${orderId}`);
        record('Customer sees it on the way with the dispatcher named', tracked.data?.status === 'OUT_FOR_DELIVERY' && !!tracked.data?.delivery?.dispatcher, brief(tracked.data?.status));
        await expectStatus(rider, 'POST', `/dispatch/deliveries/${offer.id}/delivered`, 400, 'A wrong customer code is refused', { code: tracked.data?.pickupCode === '0000' ? '1111' : '0000' });
        await expectStatus(rider, 'POST', `/dispatch/deliveries/${offer.id}/delivered`, 200, "Delivered with the customer's code", { code: tracked.data?.pickupCode });
        const done = await customer.call('GET', `/food/orders/${orderId}`);
        record('The order is completed and the delivery recorded', done.data?.status === 'COMPLETED' && done.data?.delivery?.status === 'DELIVERED', brief({ status: done.data?.status, delivery: done.data?.delivery?.status }));
        await rider.call('POST', '/dispatch/online', { online: false });
      }
    }
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
