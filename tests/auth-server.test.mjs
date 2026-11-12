import assert from 'node:assert/strict'
import { scryptSync } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createAuthHandler } from '../server/auth-server.js'

const user = {
  username: 'operator',
  email: 'operator@example.test',
  name: 'Operador de prueba',
  role: 'it',
  salt: '4921f884a1d15302ca41b87d55adcd90',
}
const password = 'Fixture-only test password'
const hash = scryptSync(password, Buffer.from(user.salt, 'hex'), 64).toString('hex')
const env = {
  SAASGUARD_SESSION_SECRET: 'a1'.repeat(32),
  SAASGUARD_PASSWORD_USERS: JSON.stringify([{ ...user, hash }]),
}
const eightHours = 8 * 60 * 60 * 1000
const signIn = (identifier = user.username, submittedPassword = password) => ({
  action: 'password', identifier, password: submittedPassword,
})

async function serverFor(t, options = { env }) {
  const server = createServer(createAuthHandler(options))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  }))

  const address = 'http://127.0.0.1:' + server.address().port
  const origin = options.env.VERCEL === '1' ? address.replace('http:', 'https:') : address
  async function request({ body, cookie, headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
    const response = await fetch(address + '/api/auth', {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
    const setCookie = response.headers.get('set-cookie')
    return { response, body: await response.json(), setCookie, cookie: setCookie?.split(';')[0] }
  }
  return request
}

test('password login creates a private cookie and logout clears it', async (t) => {
  const timestamp = 1_800_000_000_000
  const request = await serverFor(t, { env, now: () => timestamp })
  const initial = await request()
  assert.equal(initial.response.status, 200)
  assert.deepEqual(initial.body, { user: null, googleClientId: null })
  assert.equal(initial.response.headers.get('cache-control'), 'no-store')

  const login = await request({ body: signIn('  OPERATOR@EXAMPLE.TEST  ') })
  const expectedUser = {
    email: user.email, name: user.name, role: user.role, username: user.username,
    method: 'password', expiresAt: timestamp + eightHours,
  }
  assert.equal(login.response.status, 200)
  assert.deepEqual(login.body, { user: expectedUser })
  assert.match(login.setCookie, /^saasguard_session=/)
  assert.match(login.setCookie, /; Max-Age=28800; Path=\/; HttpOnly; SameSite=Lax$/)

  const restored = await request({ cookie: login.cookie })
  assert.deepEqual(restored.body, { user: expectedUser, googleClientId: null })
  const duplicate = await request({ body: signIn(), cookie: login.cookie })
  assert.equal(duplicate.response.status, 409)
  assert.equal(duplicate.setCookie, null)

  const logout = await request({ body: { action: 'logout' }, cookie: login.cookie })
  assert.equal(logout.response.status, 200)
  assert.deepEqual(logout.body, { user: null })
  assert.match(logout.setCookie, /^saasguard_session=; Max-Age=0;/)
  assert.deepEqual((await request({ cookie: logout.cookie })).body, { user: null, googleClientId: null })
})

test('Vercel mode requires HTTPS origin and marks cookies Secure', async (t) => {
  const request = await serverFor(t, { env: { ...env, VERCEL: '1' } })
  const login = await request({ body: signIn() })
  assert.equal(login.response.status, 200)
  assert.match(login.setCookie, /; Secure$/)
  const origin = new URL(login.response.url).origin
  const denied = await request({ body: { action: 'logout' }, headers: { Origin: origin }, cookie: login.cookie })
  assert.equal(denied.response.status, 403)
  assert.equal(denied.setCookie, null)
})

test('opaque password failures are rate limited and reset after the lock expires', async (t) => {
  let timestamp = 1_800_000_000_000
  const request = await serverFor(t, { env, now: () => timestamp })
  const unknown = await request({ body: signIn('unknown', password) })
  const incorrect = await request({ body: signIn(user.username, 'wrong password') })
  assert.equal(unknown.response.status, 401)
  assert.equal(incorrect.response.status, 401)
  assert.deepEqual(incorrect.body, unknown.body)
  for (let count = 0; count < 3; count += 1) {
    assert.equal((await request({ body: signIn('unknown') })).response.status, 401)
  }
  const limited = await request({ body: signIn() })
  assert.equal(limited.response.status, 429)
  assert.equal(limited.response.headers.get('retry-after'), '30')
  timestamp += 30_000
  assert.equal((await request({ body: signIn() })).response.status, 200)
})

test('session checks expire, recheck password users, and honor key rotation', async (t) => {
  let timestamp = 1_800_000_000_000
  const request = await serverFor(t, { env, now: () => timestamp })
  const { cookie } = await request({ body: signIn() })
  const withNewKey = await serverFor(t, {
    env: { ...env, SAASGUARD_SESSION_SECRET: 'b2'.repeat(32) },
    now: () => timestamp,
  })
  const withoutUser = await serverFor(t, {
    env: { ...env, SAASGUARD_PASSWORD_USERS: '[]' },
    now: () => timestamp,
  })
  assert.equal((await withNewKey({ cookie })).body.user, null)
  assert.equal((await withoutUser({ cookie })).body.user, null)
  timestamp += eightHours
  assert.equal((await request({ cookie })).body.user, null)
})

test('request validation rejects invalid origins, formats, sizes and methods', async (t) => {
  const request = await serverFor(t)
  const cases = [
    [{ body: signIn(), headers: { Origin: 'https://other.example.test' } }, 403],
    [{ body: signIn(), headers: { Origin: '' } }, 403],
    [{ body: signIn(), headers: { 'Content-Type': 'text/plain' } }, 415],
    [{ body: 'unparseable body' }, 400],
    [{ body: { action: 'unknown' } }, 400],
    [{ body: ' '.repeat(17 * 1024) }, 413],
    [{ method: 'PUT' }, 405],
  ]
  for (const [input, status] of cases) {
    const { response, body, setCookie } = await request(input)
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(Object.keys(body), ['error'])
    assert.equal(setCookie, null)
  }
})

test('missing session key and invalid password configuration fail closed', async (t) => {
  for (const invalidEnv of [{}, { ...env, SAASGUARD_PASSWORD_USERS: 'invalid JSON' }]) {
    const request = await serverFor(t, { env: invalidEnv })
    const { response, body } = await request()
    assert.equal(response.status, 503)
    assert.deepEqual(Object.keys(body), ['error'])
  }
})

test('Google delegates token verification and rechecks allowed membership on reads', async (t) => {
  let timestamp = 1_800_000_000_000
  const googleEnv = {
    ...env,
    SAASGUARD_GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
    SAASGUARD_GOOGLE_ALLOWED_EMAILS: 'finance@example.test:finance',
    SAASGUARD_GOOGLE_ALLOWED_DOMAIN: 'workspace.example.test',
  }
  const verifiedUntil = timestamp + 120_000
  let profile = {
    email: 'finance@example.test', email_verified: true, name: 'Finanzas de prueba', exp: verifiedUntil / 1000,
  }
  const calls = []
  const verifyGoogle = async (token, audience) => {
    calls.push({ token, audience })
    if (token !== 'verified-test-credential') throw new Error('Verifier rejected credential')
    return profile
  }
  const request = await serverFor(t, { env: googleEnv, now: () => timestamp, verifyGoogle })
  assert.deepEqual((await request()).body, { user: null, googleClientId: googleEnv.SAASGUARD_GOOGLE_CLIENT_ID })
  assert.equal((await request({ body: { action: 'google', credential: 'rejected-test-credential' } })).response.status, 401)

  const googleLogin = () => request({ body: { action: 'google', credential: 'verified-test-credential' } })
  const login = await googleLogin()
  assert.deepEqual(calls[1], { token: 'verified-test-credential', audience: googleEnv.SAASGUARD_GOOGLE_CLIENT_ID })
  assert.equal(login.response.status, 200)
  assert.equal(login.body.user.role, 'finance')
  assert.equal(login.body.user.expiresAt, verifiedUntil)
  assert.match(login.setCookie, /; Max-Age=120;/)
  const changedRole = await serverFor(t, {
    env: { ...googleEnv, SAASGUARD_GOOGLE_ALLOWED_EMAILS: 'finance@example.test:viewer' },
    now: () => timestamp,
  })
  const removedMember = await serverFor(t, {
    env: { ...googleEnv, SAASGUARD_GOOGLE_ALLOWED_EMAILS: '' },
    now: () => timestamp,
  })
  assert.equal((await changedRole({ cookie: login.cookie })).body.user.role, 'viewer')
  assert.equal((await removedMember({ cookie: login.cookie })).body.user, null)

  profile = { ...profile, email_verified: false }
  assert.equal((await googleLogin()).response.status, 401)
  profile = { ...profile, email_verified: true, email: 'unlisted@workspace.example.test' }
  const unlisted = await googleLogin()
  assert.equal(unlisted.response.status, 401)
  assert.doesNotMatch(unlisted.body.error, /unlisted/)

  profile = { ...profile, hd: 'workspace.example.test' }
  const domainUser = await googleLogin()
  assert.equal(domainUser.response.status, 200)
  assert.equal(domainUser.body.user.role, 'viewer')
  timestamp = verifiedUntil
  assert.equal((await request({ cookie: login.cookie })).body.user, null)
  assert.equal((await googleLogin()).response.status, 401)
})
