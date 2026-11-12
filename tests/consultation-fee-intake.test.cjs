// Paid consultation state and intake auto-advance paths: real source, mocked edges.
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
    if (spec.startsWith('node:') || spec === 'graphql') return require(spec);
    throw new Error(`Unmocked dependency: ${spec}`);
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: req, process: { env: {} }, console, URL, Date }, { filename });
  return module.exports;
}
const noop = {};
const payments = load('features/keystone/mutations/consultationPayments.ts', {
  '../access': { isHumanIdentitySession: () => true },
  '../lib/transactions': { prismaWithoutGraphQLErrorConversion: (p) => p, runSerializableTransaction: async (p, fn) => fn(p) },
  '../utils/paymentProviderAdapter': noop, './portalPayments': noop, './workflow-helpers': { recordAuditEvent: async () => {} },
});
const lifecycles = load('features/keystone/lib/lifecycles.ts', {}).lifecycles;

test('payment state: free, due, paid, refunded, expired', () => {
  assert.equal(payments.consultationPaymentState({ feeMinor: 0, status: 'requested' }, null), 'none');
  assert.equal(payments.consultationPaymentState({ feeMinor: 15000, status: 'requested' }, null), 'due');
  assert.equal(payments.consultationPaymentState({ feeMinor: 15000, status: 'requested' }, { status: 'pending', amountMinor: 15000 }), 'due');
  assert.equal(payments.consultationPaymentState({ feeMinor: 15000, status: 'requested' }, { status: 'captured', amountMinor: 15000, refundedMinor: 0 }), 'paid');
  assert.equal(payments.consultationPaymentState({ feeMinor: 15000, status: 'cancelled' }, { status: 'captured', amountMinor: 15000, refundedMinor: 15000 }), 'refunded');
  assert.equal(payments.consultationPaymentState({ feeMinor: 15000, status: 'cancelled' }, { status: 'refunded', amountMinor: 15000, refundedMinor: 15000 }), 'refunded');
  assert.equal(payments.consultationPaymentState({ feeMinor: 15000, status: 'cancelled' }, null), 'expired');
});

test('unpaid paid requests release after the checkout window only', () => {
  const now = Date.now();
  const old = new Date(now - payments.CONSULTATION_PAYMENT_WINDOW_MS - 1000);
  assert.equal(payments.unpaidRequestExpired({ feeMinor: 15000, status: 'requested', createdAt: old }, false, now), true);
  assert.equal(payments.unpaidRequestExpired({ feeMinor: 15000, status: 'requested', createdAt: old }, true, now), false);
  assert.equal(payments.unpaidRequestExpired({ feeMinor: 0, status: 'requested', createdAt: old }, false, now), false);
  assert.equal(payments.unpaidRequestExpired({ feeMinor: 15000, status: 'requested', createdAt: new Date(now) }, false, now), false);
});

test('payment key round trip', () => {
  assert.equal(payments.consultationIdFromPaymentKey(payments.consultationPaymentKey('c1')), 'c1');
  assert.equal(payments.consultationIdFromPaymentKey('retainer:r1:5000'), null);
  assert.equal(payments.consultationIdFromPaymentKey('consultation:c1:refund'), null);
});

test('every intake auto path is a legal lifecycle walk ending at its target', () => {
  const src = fs.readFileSync(path.resolve(root, 'features/keystone/mutations/intakeWorkflows.ts'), 'utf8');
  assert.match(src, /advanceIntakeOnConflictProgress/);
  assert.match(src, /advanceIntakeAfterConsultation/);
  const paths = {
    conflict_review: { new: ['screening', 'conflict_review'], screening: ['conflict_review'] },
    consultation: { new: ['screening', 'conflict_review', 'consultation'], screening: ['conflict_review', 'consultation'], conflict_review: ['consultation'] },
    decision: { new: ['screening', 'conflict_review', 'decision'], screening: ['conflict_review', 'decision'], conflict_review: ['decision'], consultation: ['decision'] },
  };
  for (const [target, byStart] of Object.entries(paths)) {
    for (const [start, steps] of Object.entries(byStart)) {
      let from = start;
      for (const to of steps) { assert.ok(lifecycles.intake[from].includes(to), `${from} -> ${to}`); from = to; }
      assert.equal(from, target);
    }
  }
});
