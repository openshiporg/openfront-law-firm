// Shared dashboard shell: GraphQL names, auth routes, sign-up/reset gating, error text,
// sidebar filtering and timestamp rendering. Node's built-in runner, same loader as
// family-security.test.cjs. No DB, network or real env.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function sandbox({ env = {}, mocks = {}, stubUnknown = false } = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    function localRequire(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      const resolved = specifier.startsWith('@/') ? path.join(root, specifier.slice(2))
        : specifier.startsWith('.') ? path.resolve(path.dirname(filename), specifier) : null;
      if (resolved && fs.existsSync(`${resolved}.ts`)) return load(`${resolved}.ts`);
      if (stubUnknown) return new Proxy({}, { get: () => () => null });
      throw new Error(`Unmocked dependency: ${specifier}`);
    }
    vm.runInNewContext(output, {
      module, exports: module.exports, require: localRequire,
      process: { env }, console: { error() {}, warn() {}, log() {} },
      URL, FormData, structuredClone,
    }, { filename });
    return module.exports;
  }
  return { load };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('getGraphQLNames never throws when the UI plural label collapses to the list key', () => {
  const { getGraphQLNames } = sandbox({ mocks: { pluralize: { __esModule: true, default: require('pluralize') } } })
    .load('features/dashboard/lib/getGqlNames.ts');
  const shop = getGraphQLNames('ShopSettings', { plural: 'Shop Settings', listQueryName: 'shopSettingsItems' });
  assert.equal(shop.listQueryName, 'shopSettingsItems');
  assert.equal(shop.listQueryCountName, 'shopSettingsItemsCount');
  assert.equal(shop.itemQueryName, 'shopSettings');
  assert.equal(shop.deleteManyMutationName, 'deleteShopSettingsItems');
  const specimen = getGraphQLNames('Specimen', { plural: 'Specimen', listQueryName: 'specimens' });
  assert.equal(specimen.listQueryName, 'specimens');
  for (const [key, plural] of [['ClientPoints', 'Client Points'], ['ShopSettings', 'Shop Settings'], ['Specimen', 'Specimen']]) {
    const names = getGraphQLNames(key, { plural });
    assert.notEqual(names.listQueryName, names.itemQueryName);
  }
  assert.equal(getGraphQLNames('Product', { plural: 'Products' }).listQueryName, 'products');
  assert.equal(getGraphQLNames('ProductCategory', { plural: 'Categories' }).listQueryName, 'productCategories');
});

test('auth routes match exactly, so look-alike list paths are not treated as public pages', () => {
  const { isDashboardRoute } = sandbox().load('features/dashboard/lib/authFlow.ts');
  assert.equal(isDashboardRoute('/dashboard/reset', 'reset'), true);
  assert.equal(isDashboardRoute('/dashboard/reset/', 'reset'), true);
  assert.equal(isDashboardRoute('/dashboard/resets', 'reset'), false);
  assert.equal(isDashboardRoute('/dashboard/reset-codes/1', 'reset'), false);
  assert.equal(isDashboardRoute('/dashboard/signin', 'signin'), true);
  assert.equal(isDashboardRoute('/dashboard/initiatives', 'init'), false);
});

function middlewareRun({ pathname, user = null, env = {} }) {
  const { handleDashboardRoutes } = sandbox({ env, mocks: {
    'next/server': {
      NextResponse: { redirect: url => ({ redirect: new URL(url).pathname }), next: () => ({ next: true }) },
    },
    '@/features/dashboard/lib/getBaseUrl': { getGraphQLEndpoint: async () => 'https://test.invalid/api/graphql' },
    'graphql-request': { GraphQLClient: class {} },
  } }).load('features/dashboard/middleware.ts');
  const url = `https://shop.invalid${pathname}`;
  return handleDashboardRoutes({ nextUrl: new URL(url), url }, user, false);
}

test('sign-up is reachable only when public sign-up is open; reset matches only its own route', async () => {
  assert.deepEqual(await middlewareRun({ pathname: '/dashboard/signup', env: { PUBLIC_SIGNUPS_ALLOWED: 'true' } }), { next: true });
  assert.deepEqual(await middlewareRun({ pathname: '/dashboard/signup' }), { redirect: '/dashboard/signin' });
  assert.deepEqual(await middlewareRun({ pathname: '/dashboard/reset' }), { next: true });
  assert.deepEqual(await middlewareRun({ pathname: '/dashboard/resets' }), { redirect: '/dashboard/signin' });
  const staff = { id: '1', role: { canAccessDashboard: true } };
  assert.deepEqual(await middlewareRun({ pathname: '/dashboard/signup', user: staff, env: { PUBLIC_SIGNUPS_ALLOWED: 'true' } }), { redirect: '/dashboard' });
  const customer = { id: '2', role: { canAccessDashboard: false } };
  assert.deepEqual(await middlewareRun({ pathname: '/dashboard/no-access', user: customer }), { next: true });

  const flow = sandbox({ env: { PUBLIC_SIGNUPS_ALLOWED: 'false' } }).load('features/dashboard/lib/authFlow.ts');
  assert.equal(flow.publicSignUpsAllowed(), false);
  assert.equal(flow.publicSignUpsAllowed({ PUBLIC_SIGNUPS_ALLOWED: 'true' }), true);
});

test('form errors show Keystone validation text, never Prisma, stack or GraphQL internals', () => {
  const { publicGraphQLErrorMessage, PUBLIC_REQUEST_ERROR } = sandbox().load('features/dashboard/lib/security.ts');
  const of = (...errors) => publicGraphQLErrorMessage({ response: { errors } });
  assert.equal(of({ message: 'You provided invalid data for this operation.\n  - User.password: Password must be at least 10 characters long',
    extensions: { code: 'KS_VALIDATION_FAILURE' } }),
  'You provided invalid data for this operation.\nPassword must be at least 10 characters long');
  assert.equal(of({ message: 'Prisma error: Unique constraint failed on the fields: (`email`)', extensions: { code: 'KS_PRISMA_ERROR' } }),
    'A record with this email already exists.');
  for (const leak of [
    { message: 'Prisma error: \nInvalid `prisma.user.create()` invocation: secret', extensions: { code: 'KS_PRISMA_ERROR' } },
    { message: 'An error occurred while running "resolveInput".\n  - Order.hooks: Invalid `prisma.order.update()` invocation', extensions: { code: 'KS_EXTENSION_ERROR' } },
    { message: 'Error: boom\n    at resolve (/app/node_modules/x.js:1:1)', extensions: { code: 'KS_VALIDATION_FAILURE' } },
    { message: 'Variable "$data" got invalid value "synthetic-password"', extensions: { code: 'BAD_USER_INPUT' } },
    { message: 'synthetic-password', extensions: { code: 'FORBIDDEN' } },
    { message: 'connect ECONNREFUSED postgres://user:pw@db', extensions: { code: 'INTERNAL_SERVER_ERROR' } },
  ]) assert.equal(of(leak), PUBLIC_REQUEST_ERROR);
  assert.equal(publicGraphQLErrorMessage(new Error('synthetic')), PUBLIC_REQUEST_ERROR);
  // The server's command and lifecycle refusals reach the form; their driver-looking cousins do not.
  assert.equal(of({ message: 'This consultation can no longer be cancelled online.', extensions: { code: 'COMMAND_REFUSED' } }),
    'This consultation can no longer be cancelled online.');
  assert.equal(of({ message: 'Matter cannot transition from open to archived.', extensions: { code: 'LIFECYCLE_REFUSED' } }),
    'Matter cannot transition from open to archived.');
  assert.equal(of({ message: 'Invalid `prisma.refund.create()` invocation', extensions: { code: 'COMMAND_REFUSED' } }), PUBLIC_REQUEST_ERROR);
});

test('a form falls back to its own sentence only when the server gave no readable refusal', () => {
  const { refusalOr, PUBLIC_REQUEST_ERROR } = sandbox().load('features/dashboard/lib/security.ts');
  assert.equal(refusalOr('This payment already has a refund.', 'fallback'), 'This payment already has a refund.');
  assert.equal(refusalOr(PUBLIC_REQUEST_ERROR, 'fallback'), 'fallback');
  assert.equal(refusalOr(undefined, 'fallback'), 'fallback');
});

function authActions({ env = {}, response }) {
  const calls = [];
  const auth = sandbox({ env, mocks: {
    'next/headers': { cookies: async () => ({ set() {} }) },
    'next/navigation': { redirect() {} },
    'next/cache': { revalidatePath() {} },
    '@/features/dashboard/lib/cookies': { removeAuthToken: async () => {} },
    '@/features/dashboard/lib/keystoneClient': { keystoneClient: async (...args) => { calls.push(args); return response; } },
  } }).load('features/dashboard/actions/auth.ts');
  return { auth, calls };
}
function form() {
  const data = new FormData();
  data.set('email', 'owner@example.invalid'); data.set('password', 'short'); data.set('name', 'Owner');
  return data;
}

test('first-run setup states the real reason, including the password rule', async () => {
  const { auth } = authActions({ response: { success: false, error: 'Password must be at least 10 characters long' } });
  const state = await auth.createInitialUser({}, form());
  assert.equal(state.message, 'Unable to create the initial user. Password must be at least 10 characters long');
  const generic = authActions({ response: { success: false, error: 'Unable to complete the request. Please try again.' } });
  assert.equal((await generic.auth.createInitialUser({}, form())).message, 'Unable to create the initial user. Please try again.');
});

test('reset says plainly when no mail transport is configured, without calling Keystone', async () => {
  const { RESET_EMAIL_UNAVAILABLE } = sandbox().load('features/dashboard/lib/authFlow.ts');
  const off = authActions({ response: { success: true, data: { sendUserPasswordResetLink: true } } });
  assert.equal((await off.auth.resetPassword({}, form(), 'request')).message, RESET_EMAIL_UNAVAILABLE);
  assert.equal(off.calls.length, 0);
  const on = authActions({ env: { SMTP_HOST: 'smtp.invalid' }, response: { success: true, data: { sendUserPasswordResetLink: true } } });
  const sent = await on.auth.resetPassword({}, form(), 'request');
  assert.match(sent.success, /reset link has been sent/);
  assert.deepEqual(plain(sent.formData), { email: 'owner@example.invalid' });
  const expired = authActions({ response: { success: true, data: { redeemUserPasswordResetToken: { code: 'TOKEN_EXPIRED' } } } });
  assert.match((await expired.auth.resetPassword({}, form(), 'reset')).message, /invalid or has expired/);
});

test('sidebar shows only lists and platform pages the session can see', () => {
  const access = sandbox().load('features/dashboard/lib/sidebarAccess.ts');
  const lists = [{ path: 'orders', isHidden: false }, { path: 'roles', isHidden: true }, { path: 'users', isHidden: true }];
  const staff = { role: { canAccessDashboard: true } };
  assert.deepEqual(plain(access.visibleSidebarLists(lists, staff)).map(list => list.path), ['orders']);
  const items = [{ href: '/dashboard/platform/orders' }, { href: '/dashboard/platform/users' },
    { href: '/dashboard/platform/analytics' }, { href: '/platform/users?tab=1' }];
  assert.deepEqual(plain(access.visiblePlatformItems(items, lists, staff)).map(item => item.href),
    ['/dashboard/platform/orders', '/dashboard/platform/analytics']);
  const customer = { role: { canAccessDashboard: false } };
  assert.equal(access.visibleSidebarLists(lists, customer).length, 0);
  assert.equal(access.visiblePlatformItems(items, lists, customer).length, 0);
  assert.equal(access.visibleSidebarLists(lists, null).length, 1);
});

test('sidebar follows the role: an attorney sees practice desks, not firm administration', () => {
  const access = sandbox().load('features/dashboard/lib/sidebarAccess.ts');
  const items = ['my-work', 'today', 'intake', 'matters', 'time-expenses', 'accounting', 'team', 'firm', 'branding']
    .map(slug => ({ href: `/dashboard/platform/${slug}` }));
  const attorney = { role: { canAccessDashboard: true, permissions: ['canAccessDashboard', 'canReadIntake', 'canReadMatters', 'canReadBilling'] } };
  assert.deepEqual(plain(access.visiblePlatformItems(items, [], attorney)).map(item => item.href.split('/').pop()),
    ['my-work', 'today', 'intake', 'matters', 'time-expenses']);
  const admin = { role: { canAccessDashboard: true, permissions: ['canAccessDashboard', 'canReadIntake', 'canReadMatters', 'canReadBilling', 'canReadTrust', 'canManagePeople', 'canManageFirm'] } };
  assert.equal(access.visiblePlatformItems(items, [], admin).length, items.length);
  // An older session shape without permission keys keeps today's behaviour.
  assert.equal(access.visiblePlatformItems(items, [], { role: { canAccessDashboard: true } }).length, items.length);
});

test('a platform page hidden from the sidebar cannot be opened by direct URL', () => {
  const access = sandbox().load('features/dashboard/lib/sidebarAccess.ts');
  const intake = { role: { canAccessDashboard: true, permissions: ['canAccessDashboard', 'canReadIntake', 'canReadCalendar'] } };
  assert.equal(access.canOpenPlatformPath('/dashboard/platform/intake', intake), true);
  assert.equal(access.canOpenPlatformPath('/dashboard/platform/work/consultation/abc', intake), true);
  for (const slug of ['team', 'billing', 'firm', 'ai/providers', 'payment-providers', 'matters/abc'])
    assert.equal(access.canOpenPlatformPath(`/dashboard/platform/${slug}`, intake), false, slug);
  // Pages with no permission entry, other dashboard routes and older session shapes stay open.
  assert.equal(access.canOpenPlatformPath('/dashboard/platform/today', intake), true);
  assert.equal(access.canOpenPlatformPath('/dashboard/contacts', intake), true);
  assert.equal(access.canOpenPlatformPath('/dashboard/platform/team', { role: { canAccessDashboard: true } }), true);
});

test('formatInZone: viewer zone by default, explicit zone when given, labelled', () => {
  const t = sandbox().load('features/dashboard/lib/storeTime.ts');
  const d = new Date('2026-11-02T18:00:00Z');
  assert.equal(t.formatInZone(d, 'America/Los_Angeles'), 'Nov 2, 2026, 10:00 AM PST');
  assert.equal(t.formatInZone(d, 'America/New_York'), 'Nov 2, 2026, 1:00 PM EST');
  assert.equal(t.formatInZone(new Date('2026-07-01T14:00:00Z'), 'America/New_York'), 'Jul 1, 2026, 10:00 AM EDT');
  assert.equal(t.formatInZone(d, 'America/New_York', 'long'), 'November 2, 2026 at 1:00 PM EST');
  assert.equal(t.formatInZone(d, 'America/New_York', 'date'), 'Nov 2, 2026');
  assert.equal(t.formatInZone(d, 'America/New_York', 'dateLong'), 'November 2, 2026');
  assert.equal(t.formatInZone('2026-11-02T18:00:00Z', 'UTC'), 'Nov 2, 2026, 6:00 PM UTC');
  // undefined / invalid zone => viewer (process) zone, still labelled
  assert.equal(t.formatInZone(d), new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d));
  assert.equal(t.formatInZone(d, 'Not/AZone'), t.formatInZone(d));
  assert.equal(t.formatInZone(null), '');
  assert.equal(t.formatInZone('nope'), '');
});

test('timestamp view renders nothing until mounted, then viewer-zone text', () => {
  const { formatTimestamp } = sandbox({ stubUnknown: true, mocks: { react: require('react') } })
    .load('features/dashboard/views/timestamp/index.tsx');
  const d = new Date('2026-11-02T18:00:00Z');
  assert.equal(formatTimestamp(d, undefined, false), '');
  assert.equal(formatTimestamp(d, 'America/Los_Angeles', true), 'Nov 2, 2026, 10:00 AM PST');
});

test('timestamp picker round-trips in the viewer zone and keeps the same instant', () => {
  const t = sandbox().load('features/dashboard/lib/storeTime.ts');
  for (const zone of [undefined, 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata']) {
    for (const iso of ['2026-11-02T15:00:00.000Z', '2026-07-01T14:30:15.000Z', '2026-03-08T07:30:00.000Z', '2026-11-01T05:59:59.000Z']) {
      const d = new Date(iso);
      const [h, m, sec] = t.formatTimeInputInZone(d, zone).split(':').map(Number);
      assert.equal(t.withTimeInZone(d, h, m, sec, zone).toISOString(), iso);
      assert.equal(t.withCalendarDayInZone(t.calendarDayForZone(d, zone), d, zone).toISOString(), iso);
    }
  }
  // typed 10:00 means 10:00 in the zone
  assert.equal(t.withTimeInZone(new Date('2026-11-02T20:00:00Z'), 10, 0, 0, 'America/New_York').toISOString(), '2026-11-02T15:00:00.000Z');
});

test('password emails: invites read "Set up", resets read "Reset", both named from the firm record', async () => {
  const sent = [];
  const mail = sandbox({
    env: { SMTP_HOST: 'smtp.invalid', SMTP_FROM: 'firm@example.invalid', SMTP_PORT: '587', SMTP_STORE_LINK: 'https://firm.example.invalid' },
    mocks: { nodemailer: { createTransport: () => ({ sendMail: async (m) => { sent.push(m); } }) } },
  }).load('features/keystone/lib/mail.ts');
  const prisma = (memberships, firms = [{ name: 'Example Firm' }]) => ({
    user: { findUnique: async () => ({ firmMemberships: memberships }) },
    firm: { findMany: async () => firms },
  });
  const invited = await mail.passwordEmailWording(prisma([{ status: 'invited', firm: { name: 'Harbor & Pine' } }]), 'u1');
  assert.deepEqual(plain(invited), { kind: 'invite', firmName: 'Harbor & Pine' });
  const active = await mail.passwordEmailWording(prisma([{ status: 'active', firm: { name: '', displayName: 'Cedar Law' } }]), 'u2');
  assert.deepEqual(plain(active), { kind: 'reset', firmName: 'Cedar Law' });
  const customer = await mail.passwordEmailWording(prisma([], [{ name: 'Only Firm' }]), 'u3');
  assert.deepEqual(plain(customer), { kind: 'reset', firmName: 'Only Firm' });
  const ambiguous = await mail.passwordEmailWording(prisma([], [{ name: 'A' }, { name: 'B' }]), 'u4');
  assert.equal(ambiguous.firmName, null);

  await mail.sendPasswordResetEmail('tok', 'a@example.invalid', undefined, 'staff', invited);
  await mail.sendPasswordResetEmail('tok', 'b@example.invalid', undefined, 'customer', { kind: 'reset', firmName: 'Harbor & Pine' });
  await mail.sendPasswordResetEmail('tok', 'c@example.invalid');
  assert.equal(sent[0].subject, 'Set up your Harbor & Pine sign-in');
  assert.match(sent[0].html, />Set up sign-in</);
  assert.match(sent[0].html, /\/dashboard\/reset\?token=tok/);
  assert.equal(sent[1].subject, 'Reset your Harbor & Pine password');
  assert.match(sent[1].html, /\/account\/reset\?token=tok/);
  assert.equal(sent[2].subject, 'Reset your password');
  assert.ok(sent.every((m) => !/password reset token/i.test(m.subject)));
});
