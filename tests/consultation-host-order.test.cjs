const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// The ordering rule is pure; compile just that function out of the mutation file.
const source = fs.readFileSync(path.join(__dirname, '../features/keystone/mutations/customerConsultations.ts'), 'utf8')
const start = source.indexOf('const personKey')
const end = source.indexOf('/** Busy intervals per host')
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
new Function('exports', 'module', js)(mod.exports, mod)
const { orderHostsForService } = mod.exports

const hosts = [{ name: 'Demo Admin' }, { name: 'Margaret Hale' }, { name: 'Eleanor Marsh' }, { name: 'Priya Raman' }]
const profiles = [
  { name: 'Eleanor Marsh', practiceAreas: [{ id: 'estate' }] },
  { name: 'priya  raman', practiceAreas: [{ id: 'estate' }, { id: 'family' }] },
]

test('a request goes first to the attorney published for that practice area', () => {
  assert.deepEqual(orderHostsForService(hosts, profiles, 'family').map((h) => h.name), ['Priya Raman', 'Eleanor Marsh', 'Demo Admin', 'Margaret Hale'])
})
test('attorneys sharing a practice area keep membership order', () => {
  assert.deepEqual(orderHostsForService(hosts, profiles, 'estate').map((h) => h.name).slice(0, 2), ['Eleanor Marsh', 'Priya Raman'])
})
test('with no published profiles the membership order is unchanged', () => {
  assert.deepEqual(orderHostsForService(hosts, [], 'family'), hosts)
})
