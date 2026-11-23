const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(require.resolve('../features/keystone/database-url.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = { exports: {} }
new Function('exports', 'module', code)(mod.exports, mod)
const { pooledDatabaseUrl } = mod.exports

test('web and worker pools do not retain large prepared-statement trees', () => {
  for (const role of ['web', 'worker']) {
    const url = new URL(pooledDatabaseUrl('postgresql://u:p@example.invalid/db', role))
    assert.equal(url.searchParams.get('statement_cache_size'), '0')
    assert.match(url.searchParams.get('options'), /jit=off/)
    assert.ok(Number(url.searchParams.get('connection_limit')) > 0)
  }
})
test('a preconfigured connection limit still gets the memory-safe statement default', () => {
  const url = new URL(pooledDatabaseUrl('postgresql://u:p@example.invalid/db?connection_limit=3'))
  assert.equal(url.searchParams.get('connection_limit'), '3')
  assert.equal(url.searchParams.get('statement_cache_size'), '0')
})
test('an explicit statement cache setting is preserved', () => {
  const url = new URL(pooledDatabaseUrl('postgresql://u:p@example.invalid/db?statement_cache_size=2'))
  assert.equal(url.searchParams.get('statement_cache_size'), '2')
})
