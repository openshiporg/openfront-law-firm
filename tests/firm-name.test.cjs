// Storefront Firm name resolution: Firm name wins, Display name falls back. Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'features/storefront/lib/storefront-settings.ts'), 'utf8');
const fn = src.match(/export function resolveFirmName[\s\S]*?\n}\n/)[0];
const out = ts.transpileModule(fn, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', out)(m, m.exports);
const { resolveFirmName } = m.exports;

test('Firm name set: the Firm name is used', () => {
  assert.equal(resolveFirmName({ name: 'Harbor QA', displayName: 'Other' }), 'Harbor QA');
});
test('Firm name blank: the Display name is used', () => {
  assert.equal(resolveFirmName({ name: '  ', displayName: 'Display' }), 'Display');
  assert.equal(resolveFirmName({ name: null, displayName: 'Display' }), 'Display');
});
test('both blank: null so the neutral fallback shows', () => {
  assert.equal(resolveFirmName({ name: '', displayName: ' ' }), null);
  assert.equal(resolveFirmName({}), null);
});
test('the settings projection and portal brand use the same precedence', () => {
  assert.match(src, /const firmName = resolveFirmName\(firm\)/);
  const brand = fs.readFileSync(path.join(root, 'features/storefront/portal/FirmBrand.tsx'), 'utf8');
  assert.match(brand, /brand\.name\?\.trim\(\) \|\| brand\.displayName\?\.trim\(\)/);
});
