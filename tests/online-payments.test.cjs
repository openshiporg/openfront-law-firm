// Online payment settlement tests: load the real source with mocked framework/db/provider edges.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, mocks) {
  const cache = new Map();
  function loadFile(rel) {
    const filename = path.resolve(root, rel);
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    const req = (spec) => {
      if (Object.hasOwn(mocks, spec)) return mocks[spec];
      if (spec.startsWith('node:')) return require(spec);
      throw new Error(`Unmocked dependency: ${spec}`);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: req, process: { env: {} }, console, URL }, { filename });
    return module.exports;
  }
  return loadFile(relative);
}

// Fake database holding one payment; the tx exposes only what reconcile touches.
function fixture({ paymentType = 'operating', status = 'pending', providerAmount = 5000, providerCurrency = 'USD' } = {}) {
  const state = { payment: { id: 'pay1', firmId: 'f1', payerId: 'c1', paymentType, status, amountMinor: 5000, currencyCode: 'USD', providerPaymentId: 'cs_test_1', paymentNumber: 'PAY-1', invoiceId: 'inv1', trustLedgerAccountId: 'led1', trustAccountId: 'ta1', paymentProvider: { id: 'pp1' } }, allocations: 0, postings: 0 };
  const tx = {
    $executeRaw: async () => 0,
    payment: {
      findFirst: async () => ({ ...state.payment }),
      update: async ({ data }) => { Object.assign(state.payment, data); return state.payment; },
    },
    invoice: { findFirst: async () => ({ id: 'inv1', matterId: 'm1', balanceDueMinor: 5000 }) },
    trustLedgerAccount: { findFirst: async () => ({ id: 'led1', trustAccountId: 'ta1', trustAccount: { id: 'ta1' } }) },
  };
  const prisma = { payment: tx.payment };
  const mocks = {
    '../lib/portal-auth': { authenticatePortalSession: async (token) => token === 'good' ? { firmId: 'f1', portalAccountId: 'pa1', contactId: 'c1' } : null },
    '../lib/portal-share-binding': { portalShareHeaderSelect: {}, boundPortalShare: () => null, portalShareIsCurrent: async () => false },
    '../lib/transactions': { prismaWithoutGraphQLErrorConversion: (p) => p, runSerializableTransaction: async (_p, cb) => cb(tx) },
    '../utils/paymentProviderAdapter': { createPayment: async () => { throw new Error('must not be called'); }, getPaymentStatus: async () => ({ status: 'succeeded', amount: providerAmount, currency: providerCurrency }) },
    './postTrustTransaction': { applyTrustPosting: async (_tx, _f, actor, data) => { assert.equal(actor, null); assert.equal(data.sourcePaymentId, 'pay1'); assert.equal(data.idempotencyKey, 'online-trust:pay1'); state.postings += 1; } },
    './billingWorkflows': { applyInvoiceAllocation: async () => { state.allocations += 1; } },
  };
  state.prisma = { ...prisma, payment: { findFirst: async () => ({ ...state.payment, paymentProvider: { id: 'pp1' }, invoice: {} }), update: tx.payment.update } };
  return { state, mocks };
}

test('duplicate reconcile allocates an invoice payment exactly once', async () => {
  const { state, mocks } = fixture();
  const { reconcilePaymentByProviderId } = load('features/keystone/mutations/portalPayments.ts', mocks);
  const first = await reconcilePaymentByProviderId(state.prisma, 'pay1', 'f1');
  const second = await reconcilePaymentByProviderId(state.prisma, 'pay1', 'f1');
  assert.equal(first.status, 'captured');
  assert.equal(second.replayed, true);
  assert.equal(state.allocations, 1);
});

test('duplicate reconcile posts a trust deposit exactly once', async () => {
  const { state, mocks } = fixture({ paymentType: 'trust_deposit' });
  const { reconcilePaymentByProviderId } = load('features/keystone/mutations/portalPayments.ts', mocks);
  await reconcilePaymentByProviderId(state.prisma, 'pay1', 'f1');
  await reconcilePaymentByProviderId(state.prisma, 'pay1', 'f1');
  assert.equal(state.postings, 1);
  assert.equal(state.allocations, 0);
});

test('provider amount or currency mismatch is rejected without settling', async () => {
  for (const override of [{ providerAmount: 4999 }, { providerCurrency: 'EUR' }]) {
    const { state, mocks } = fixture(override);
    const { reconcilePaymentByProviderId } = load('features/keystone/mutations/portalPayments.ts', mocks);
    await assert.rejects(() => reconcilePaymentByProviderId(state.prisma, 'pay1', 'f1'), /mismatch/);
    assert.equal(state.payment.status, 'pending');
    assert.equal(state.allocations, 0);
  }
});

test('a portal account whose share does not cover the invoice cannot start payment', async () => {
  const { mocks } = fixture();
  const tx = { portalShare: { findMany: async () => [] }, invoice: { findFirst: async () => { throw new Error('must not read invoice'); } } };
  mocks['../lib/transactions'].runSerializableTransaction = async (_p, cb) => cb(tx);
  const { startPortalPayment } = load('features/keystone/mutations/portalPayments.ts', mocks);
  await assert.rejects(() => startPortalPayment(null, { kind: 'invoice', id: 'foreign-invoice', token: 'good' }, { prisma: {} }), /not shared/);
  await assert.rejects(() => startPortalPayment(null, { kind: 'invoice', id: 'inv1', token: 'bad' }, { prisma: {} }), /no longer active/);
});

test('a foreign portal account cannot reconcile another client payment', async () => {
  const { state, mocks } = fixture();
  state.prisma.payment.findFirst = async ({ where }) => where.payerId === 'c1' ? null : { ...state.payment };
  const { reconcilePortalPayment } = load('features/keystone/mutations/portalPayments.ts', mocks);
  await assert.rejects(() => reconcilePortalPayment(null, { paymentId: 'pay1', token: 'good' }, { prisma: state.prisma }), /not available/);
});
