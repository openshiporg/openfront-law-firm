// Two clients race for one time: the database books one (serializable transaction + host locks in
// bookClientConsultation). This covers what the other client is told by the storefront action.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, mocks) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const req = (spec) => {
    if (Object.hasOwn(mocks, spec)) return mocks[spec];
    throw new Error(`Unmocked dependency: ${spec}`);
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: req, process: { env: {} }, console, encodeURIComponent }, { filename });
  return module.exports;
}

const security = load('features/dashboard/lib/security.ts', {});
function action(response) {
  const seen = { revalidated: [], redirected: [] };
  const actions = load('features/storefront/actions/customer-account.ts', {
    'next/headers': {}, '@/features/keystone/context': {},
    'next/navigation': { redirect: (url) => { seen.redirected.push(url); throw new Error('redirect'); } },
    'next/cache': { revalidatePath: (p) => seen.revalidated.push(p) },
    '@/features/dashboard/lib/keystoneClient': { keystoneClient: async () => response },
    '@/features/dashboard/lib/security': security,
  });
  return { seen, book: actions.bookConsultation };
}
function form(fields) {
  const data = { serviceId: 'svc', requestKey: '11111111-1111-4111-8111-111111111111', acknowledgmentVersion: 'v1', startsAt: '2026-12-01T15:00:00.000Z', jurisdiction: 'Maine', opposingParties: 'None known', acknowledgment: 'yes', ...fields };
  return { get: (name) => data[name] ?? null };
}
const start = { error: null, values: {}, revision: 0 };
const TAKEN = 'This time is no longer available. Choose another time.';

test('the client who loses a race for a time is told so and offered the current times', async () => {
  // What the API returns for the booking command's own refusal (COMMAND_REFUSED).
  const error = security.publicGraphQLErrorMessage({ response: { errors: [{ message: TAKEN, extensions: { code: 'COMMAND_REFUSED' } }] } });
  const { seen, book } = action({ success: false, error });
  const state = await book(start, form());
  assert.equal(state.outcome, 'rejected');
  assert.equal(state.error, TAKEN);
  assert.equal(state.values.startsAt, '', 'the taken time is not re-selected');
  assert.equal(state.values.jurisdiction, 'Maine', 'what the client typed is kept');
  assert.deepEqual(seen.revalidated, ['/consultation'], 'open times are read again');
  assert.equal(seen.redirected.length, 0);
});

test('a failure with no readable refusal stays an unconfirmed outcome with its reference', async () => {
  for (const error of [security.PUBLIC_REQUEST_ERROR, security.publicGraphQLErrorMessage({ response: { errors: [{ message: 'Transaction failed due to a write conflict', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] } })]) {
    const { seen, book } = action({ success: false, error });
    const state = await book(start, form());
    assert.equal(state.outcome, 'unknown');
    assert.equal(state.requestKey, '11111111-1111-4111-8111-111111111111');
    assert.equal(state.values.startsAt, '2026-12-01T15:00:00.000Z');
    assert.deepEqual(seen.revalidated, []);
  }
});
