const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

function loadConstraintRefusal() {
  const src = fs.readFileSync(path.join(__dirname, "../features/keystone/lib/graphql-security.ts"), "utf8");
  const start = src.indexOf("export function constraintRefusal");
  const end = src.indexOf("export function maskGraphqlError");
  const code = ts.transpileModule(`${src.slice(start, end)}\nmodule.exports = { constraintRefusal };`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { module: { exports: {} } };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports.constraintRefusal;
}

test("constraint violations become coded refusals without SQL detail", () => {
  const constraintRefusal = loadConstraintRefusal();
  assert.equal(constraintRefusal({ code: "P2002" }).code, "CONFLICT");
  const check = new Error('new row for relation "Payment" violates check constraint "Payment_refund_within_amount"');
  const refusal = constraintRefusal({ message: "wrapped", originalError: check });
  assert.equal(refusal.code, "INVARIANT_REFUSED");
  assert.doesNotMatch(refusal.message, /Payment_refund_within_amount|relation/);
  assert.equal(constraintRefusal(new Error("Invoice has no payable balance for this client.")), null);
});

test("money and time invariants are in the migration and the mask uses them", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../migrations/20261107170000_law_money_invariants/migration.sql"), "utf8");
  for (const name of ["Invoice_amounts_consistent", "Payment_refund_within_amount", "PaymentAllocation_amount_positive", "TrustLedgerEntry_amount_positive", "Consultation_window_valid", "AgentGrant_window_valid"]) {
    assert.match(sql, new RegExp(name));
  }
  // Void keeps its total but zeroes the balance: the arithmetic check must allow that.
  assert.match(sql, /"status" = 'void' OR "balanceDueMinor" = "totalMinor" - "paidMinor"/);
  const security = fs.readFileSync(path.join(__dirname, "../features/keystone/lib/graphql-security.ts"), "utf8");
  assert.match(security, /constraintRefusal\(error\.originalError \?\? error\)/);
});
