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
const { hostsForService } = mod.exports

const hosts = [
  { name: 'Demo Admin', email: 'admin@firm.test', managesFirm: true },
  { name: 'Margaret Hale', email: 'margaret@firm.test', managesFirm: true },
  { name: 'Eleanor Marsh', email: 'eleanor@firm.test', managesFirm: false },
  { name: 'Priya Raman', email: 'priya@firm.test', managesFirm: false },
  { name: 'Marcus Bell', email: 'marcus@firm.test', managesFirm: false },
]
const profiles = [
  { name: 'Eleanor Marsh', practiceAreas: [{ id: 'estate' }] },
  { name: 'priya  raman', practiceAreas: [{ id: 'estate' }, { id: 'family' }] },
]
const names = (list) => list.map((h) => h.name)

test('a request is booked only with an attorney published for that practice area', () => {
  assert.deepEqual(names(hostsForService(hosts, profiles, 'family')), ['Priya Raman'])
  assert.deepEqual(names(hostsForService(hosts, profiles, 'estate')), ['Eleanor Marsh', 'Priya Raman'])
})
test('a practice area with no named attorney falls back to the other published attorneys', () => {
  assert.deepEqual(names(hostsForService(hosts, profiles, 'tax')), ['Eleanor Marsh', 'Priya Raman'])
})
test('with no published profiles intake staff take requests, never a firm administrator', () => {
  assert.deepEqual(names(hostsForService(hosts, [], 'family')), ['Eleanor Marsh', 'Priya Raman', 'Marcus Bell'])
  assert.deepEqual(hostsForService(hosts.slice(0, 2), [], 'family'), [])
})
test('an administrator who is also a published attorney for the area can take it', () => {
  assert.deepEqual(names(hostsForService(hosts, [{ name: 'Someone Else', email: 'Margaret@firm.test', practiceAreas: [{ id: 'family' }] }], 'family')), ['Margaret Hale'])
})
