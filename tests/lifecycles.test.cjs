const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The lifecycle map is TypeScript; read it as data so this stays a plain node test.
const source = fs.readFileSync(path.join(__dirname, "../features/keystone/lib/lifecycles.ts"), "utf8");
const body = source.slice(source.indexOf("{"), source.indexOf("} as const"));
const lifecycles = Function(`return (${body}})`)();

test("every transition targets a state the lifecycle defines", () => {
  for (const [name, map] of Object.entries(lifecycles)) {
    for (const [from, targets] of Object.entries(map)) {
      for (const to of targets) assert.ok(to in map, `${name}: ${from} -> ${to} is not a defined state`);
    }
  }
});

test("every non-final state can reach a final state (no accidental dead ends)", () => {
  for (const [name, map] of Object.entries(lifecycles)) {
    const finals = new Set(Object.entries(map).filter(([, t]) => t.length === 0).map(([s]) => s));
    if (!finals.size) continue;
    for (const start of Object.keys(map)) {
      const seen = new Set([start]); const queue = [start]; let ok = finals.has(start);
      while (queue.length && !ok) for (const n of map[queue.shift()] ?? []) { if (finals.has(n)) ok = true; if (!seen.has(n)) { seen.add(n); queue.push(n); } }
      assert.ok(ok, `${name}: ${start} cannot reach a final state`);
    }
  }
});

test("a provider-confirmed charge is recorded from every non-final payment state", () => {
  const p = lifecycles.providerPayment;
  for (const from of ["pending", "authorized", "failed", "cancelled"]) assert.ok(p[from].includes("captured"), from);
  assert.deepEqual(p.settled, []);
  // the staff-driven payment map still refuses to revive a cancelled payment by hand
  assert.ok(!lifecycles.payment.cancelled.includes("captured"));
});

test("settled money states and refunds are final", () => {
  assert.deepEqual(lifecycles.refund.succeeded, []);
  assert.deepEqual(lifecycles.payment.settled, []);
  assert.deepEqual(lifecycles.invoice.void, []);
  assert.ok(!lifecycles.invoice.void.length);
});

test("late provider capture clears the stale failure marks", () => {
  const src = fs.readFileSync(path.join(__dirname, "../features/keystone/mutations/portalPayments.ts"), "utf8");
  assert.match(src, /assertLifecycleTransition\("providerPayment", current\.status, "captured"\)/);
  assert.match(src, /status: "captured", capturedAt: new Date\(\), failedAt: null, failureReason: ""/);
});
