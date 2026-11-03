import assert from 'node:assert/strict'
import test from 'node:test'

import { signInternalClientIdentity, verifiedInternalIdentity } from '../security/internalIdentity'
import {
  clientSourceFromHeaders,
  createInternalGraphqlFetch,
  internalGraphqlEndpoint,
  internalIdentityHeaders,
  loopbackOrigin,
} from './internal-origin'

const SECRET = 'a'.repeat(40)

// This repo has no IP-keyed limiter; the verifier is shipped for the fleet pattern and must stay strict.
function requestIdentity(headers: Record<string, string>, socket: string | null | undefined, secret: string, now: number) {
  return verifiedInternalIdentity(headers, socket, secret, now) ?? (socket || 'unknown-local-client')
}

test('loopback origin comes from the process PORT only', () => {
  assert.equal(loopbackOrigin('4321'), 'http://127.0.0.1:4321')
  assert.equal(internalGraphqlEndpoint('4321'), 'http://127.0.0.1:4321/api/graphql')
  assert.equal(loopbackOrigin(undefined), null)
  assert.equal(loopbackOrigin('abc'), null)
  assert.equal(loopbackOrigin('70000'), null)
})

test('source is the end user real IP, never a shared constant', () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null })
  assert.equal(clientSourceFromHeaders(h({ 'x-real-ip': '203.0.113.7' })), '203.0.113.7')
  assert.equal(clientSourceFromHeaders(h({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })), '198.51.100.2')
  assert.equal(clientSourceFromHeaders(h({})), null)
  assert.equal(clientSourceFromHeaders(null), null)
})

test('signed headers are produced for a source and secret, and distinct per visitor', () => {
  const a = internalIdentityHeaders('203.0.113.7', SECRET)
  const b = internalIdentityHeaders('203.0.113.8', SECRET)
  assert.deepEqual(Object.keys(a).sort(), ['x-openfront-client-identity', 'x-openfront-client-signature', 'x-openfront-client-timestamp'])
  assert.notEqual(a['x-openfront-client-identity'], b['x-openfront-client-identity'])
})

test('short secret, missing secret or missing source sends unsigned and never throws', () => {
  assert.deepEqual(internalIdentityHeaders('203.0.113.7', 'short'), {})
  assert.deepEqual(internalIdentityHeaders('203.0.113.7', ''), {})
  assert.deepEqual(internalIdentityHeaders(null, SECRET), {})
})

function signedHeaders(now: number, source = '203.0.113.7', secret = SECRET) {
  const signed = signInternalClientIdentity(source, secret, now)!
  return {
    signed,
    headers: {
      'x-openfront-client-identity': signed.identity,
      'x-openfront-client-timestamp': signed.timestamp,
      'x-openfront-client-signature': signed.signature,
    } as Record<string, string>,
  }
}

test('SECURITY (a) valid signature from a loopback socket becomes the forwarded identity', () => {
  const now = Date.now()
  const { signed, headers } = signedHeaders(now)
  for (const socket of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    assert.equal(requestIdentity(headers, socket, SECRET, now), `forwarded:${signed.identity}`)
  }
})

test('SECURITY (b) the same valid headers from a non-loopback socket are ignored', () => {
  const now = Date.now()
  const { headers } = signedHeaders(now)
  for (const socket of ['10.0.0.5', '100.64.0.9', '203.0.113.99', '::ffff:10.0.0.5']) {
    const id = requestIdentity(headers, socket, SECRET, now)
    assert.ok(!id.startsWith('forwarded:'), socket)
    assert.equal(id, socket)
  }
  assert.ok(!requestIdentity(headers, undefined, SECRET, now).startsWith('forwarded:'))
  assert.ok(!requestIdentity({ 'x-forwarded-for': '127.0.0.1' }, '10.0.0.5', SECRET, now).startsWith('forwarded:'))
})

test('SECURITY (c) a timestamp older (or newer) than 90 seconds is ignored; 89s still passes', () => {
  const now = Date.now()
  const { signed, headers } = signedHeaders(now)
  assert.equal(requestIdentity(headers, '127.0.0.1', SECRET, now + 89_000), `forwarded:${signed.identity}`)
  assert.ok(!requestIdentity(headers, '127.0.0.1', SECRET, now + 92_000).startsWith('forwarded:'))
  assert.ok(!requestIdentity(headers, '127.0.0.1', SECRET, now - 92_000).startsWith('forwarded:'))
})

test('SECURITY (d) a bad signature, or a tampered identity or timestamp, is ignored', () => {
  const now = Date.now()
  const { headers } = signedHeaders(now)
  const ok = (h: Record<string, string>) => !requestIdentity(h, '127.0.0.1', SECRET, now).startsWith('forwarded:')
  assert.ok(ok({ ...headers, 'x-openfront-client-signature': 'b'.repeat(64) }))
  assert.ok(ok({ ...headers, 'x-openfront-client-identity': 'c'.repeat(64) }))
  assert.ok(ok({ ...headers, 'x-openfront-client-timestamp': String(Math.floor(now / 1000) + 1) }))
  assert.ok(ok({ ...headers, 'x-openfront-client-signature': 'nothex' }))
  assert.ok(ok({}))
  assert.ok(ok({ ...headers, 'x-openfront-client-signature': signedHeaders(now, '203.0.113.7', 'z'.repeat(40)).signed.signature }))
})

test('SECURITY (e) a secret shorter than 32 characters is ignored and cannot sign', () => {
  const now = Date.now()
  const short = 's'.repeat(31)
  assert.equal(signInternalClientIdentity('203.0.113.7', short, now), null)
  // Headers signed with a long secret are not trusted by a verifier configured with a short one.
  const { headers } = signedHeaders(now)
  assert.ok(!requestIdentity(headers, '127.0.0.1', short, now).startsWith('forwarded:'))
  // Headers forged with the short secret by hand are not trusted either.
  const { createHash, createHmac } = require('node:crypto')
  const identity = createHash('sha256').update('203.0.113.7').digest('hex')
  const timestamp = String(Math.floor(now / 1000))
  const signature = createHmac('sha256', short).update(`${timestamp}:${identity}`).digest('hex')
  const forged = { 'x-openfront-client-identity': identity, 'x-openfront-client-timestamp': timestamp, 'x-openfront-client-signature': signature }
  assert.ok(!requestIdentity(forged, '127.0.0.1', short, now).startsWith('forwarded:'))
})

test('internal fetch signs each server request and refuses other targets', async () => {
  const original = globalThis.fetch
  const prev = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = SECRET
  let seen: Headers | undefined
  globalThis.fetch = (async (_url: any, init: any) => {
    seen = new Headers(init.headers)
    return new Response('{}')
  }) as typeof fetch
  try {
    const f = createInternalGraphqlFetch('203.0.113.7', 'http://127.0.0.1:4321/api/graphql')
    await f('http://127.0.0.1:4321/api/graphql', { method: 'POST', headers: { cookie: 'keystonejs-session=x' } })
    assert.equal(seen?.get('cookie'), 'keystonejs-session=x')
    assert.match(seen?.get('x-openfront-client-identity') || '', /^[a-f0-9]{64}$/)
    await assert.rejects(() => f('https://evil.example/api/graphql', {}), /loopback GraphQL endpoint/)
    await assert.rejects(() => f('http://127.0.0.1:4321/other', {}), /loopback GraphQL endpoint/)
    process.env.SESSION_SECRET = 'short'
    await f('http://127.0.0.1:4321/api/graphql', {})
    assert.equal(seen?.get('x-openfront-client-identity'), null)
  } finally {
    globalThis.fetch = original
    if (prev === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = prev
  }
})

test('browser never signs: the dashboard target falls back to the public endpoint when window exists', async () => {
  ;(globalThis as any).window = { location: { origin: 'https://repo.example' } }
  try {
    const { getServerGraphQLTarget } = await import('../../dashboard/lib/getBaseUrl')
    const target = await getServerGraphQLTarget()
    assert.equal(target.endpoint, 'https://repo.example/api/graphql')
    assert.equal(target.fetch, undefined)
  } finally {
    delete (globalThis as any).window
  }
})

test('two different visitors get two different signed identities (no frozen first-visitor identity)', async () => {
  const original = globalThis.fetch
  const prev = process.env.SESSION_SECRET
  const prevPort = process.env.PORT
  process.env.SESSION_SECRET = SECRET
  process.env.PORT = '4321'
  const seen: string[] = []
  globalThis.fetch = (async (_url: any, init: any) => {
    seen.push(new Headers(init.headers).get('x-openfront-client-identity') || '')
    return new Response('{}')
  }) as typeof fetch
  try {
    const { getServerGraphQLTarget } = await import('../../dashboard/lib/getBaseUrl')
    const h = (ip: string) => ({ get: (n: string) => (n === 'x-real-ip' ? ip : null) })
    for (const ip of ['203.0.113.7', '203.0.113.8', '203.0.113.7']) {
      const target = await getServerGraphQLTarget(h(ip))
      assert.equal(target.endpoint, 'http://127.0.0.1:4321/api/graphql')
      await target.fetch!(target.endpoint, { method: 'POST' })
    }
    assert.match(seen[0], /^[a-f0-9]{64}$/)
    assert.notEqual(seen[0], seen[1])
    assert.equal(seen[0], seen[2])
  } finally {
    globalThis.fetch = original
    if (prev === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prev
    if (prevPort === undefined) delete process.env.PORT; else process.env.PORT = prevPort
  }
})

test('server GraphQL clients are built per request, never cached at module or instance level', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  for (const file of CLIENT_FILES) {
    if (!existsSync(new URL(file, import.meta.url))) continue
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!/clientPromise|private client\b|let\s+\w*[cC]lient\s*[:=]/.test(src), `${file} must not cache a client`)
  }
})

const CLIENT_FILES = ['../../dashboard/lib/keystoneClient.ts', '../../dashboard/middleware.ts']
