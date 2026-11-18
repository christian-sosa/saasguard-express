import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID, scryptSync } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { neon } from '@neondatabase/serverless'
import { createAuthHandler } from '../server/auth-server.js'
import { createSavingsHistoryHandler } from '../server/savings-history.js'

const timestamp = 1_800_000_000_000
const savedAt = new Date(timestamp).toISOString()
const password = 'Fixture history test password'
const account = {
  username: 'sample-finance',
  email: 'sample-finance@example.test',
  name: 'Cuenta de prueba',
  role: 'finance',
  salt: 'd5'.repeat(16),
}
const viewer = { ...account, username: 'sample-viewer', email: 'sample-viewer@example.test', role: 'viewer' }
const hash = scryptSync(password, Buffer.from(account.salt, 'hex'), 64).toString('hex')
const env = {
  SAASGUARD_SESSION_SECRET: 'ab'.repeat(32),
  SAASGUARD_PASSWORD_USERS: JSON.stringify([{ ...account, hash }, { ...viewer, hash }]),
  SAASGUARD_GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  SAASGUARD_GOOGLE_ALLOWED_EMAILS: account.email + ':finance,sample-renamed@example.test:finance',
}
const summary = {
  auditId: randomUUID(),
  providers: ['Slack', 'Otro'],
  potentialSavingsCents: 8500,
  selectedSavingsCents: 2000,
  candidateCount: 6,
  selectedCount: 2,
  unknownCostCount: 1,
  selectedUnknownCostCount: 1,
}

function memoryStore() {
  const records = new Map()
  return {
    async list(owner, cursor, limit) {
      return [...(records.get(owner)?.values() ?? [])]
        .filter((entry) => !cursor || entry.savedAt < cursor.savedAt
          || (entry.savedAt === cursor.savedAt && entry.auditId < cursor.auditId))
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt) || right.auditId.localeCompare(left.auditId))
        .slice(0, limit)
    },
    async save(owner, value) {
      if (!records.has(owner)) records.set(owner, new Map())
      const entry = { ...value, savedAt }
      records.get(owner).set(value.auditId, entry)
      return entry
    },
  }
}

async function serverFor(t, { store = memoryStore(), config = env, clock = () => timestamp,
  subject = 'sample-google-subject' } = {}) {
  const auth = createAuthHandler({
    env: config,
    now: clock,
    verifyGoogle: async (credential) => ({
      email: credential === 'renamed-user' ? 'sample-renamed@example.test' : account.email,
      email_verified: true, sub: subject, exp: timestamp / 1000 + 3600,
    }),
  })
  const history = createSavingsHistoryHandler({ env: config, now: clock, store })
  const server = createServer((req, res) => req.url === '/api/auth' ? auth(req, res) : history(req, res))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  }))

  const origin = 'http://127.0.0.1:' + server.address().port
  async function request(path, { cookie, sessionTag, body, method = body ? 'PUT' : 'GET', requestOrigin = origin } = {}) {
    const response = await fetch(origin + path, {
      method,
      headers: {
        Origin: requestOrigin, 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }),
        ...(sessionTag && { 'X-SaaSGuard-Session': sessionTag }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const payload = await response.json()
    return {
      status: response.status, body: payload, sessionTag: payload.user?.sessionTag,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      cacheControl: response.headers.get('cache-control'),
    }
  }

  return {
    history: (options = {}, cursor) => request(
      '/api/savings-history' + (cursor === undefined ? '' : '?cursor=' + encodeURIComponent(cursor)), options,
    ),
    login: (identifier) => request('/api/auth', { method: 'POST', body: { action: 'password', identifier, password } }),
    google: (credential) => request('/api/auth', { method: 'POST', body: { action: 'google', credential } }),
  }
}

test('history derives ownership from the signed account and replaces a repeated save', async (t) => {
  const app = await serverFor(t)
  const passwordUser = await app.login(account.username)
  const googleUser = await app.google('first-login')
  assert.equal(passwordUser.status, 200)
  assert.equal(googleUser.status, 200)
  assert.equal(googleUser.body.user.email, passwordUser.body.user.email)

  const first = await app.history({ ...passwordUser, body: summary })
  assert.equal(first.status, 200)
  assert.equal(first.cacheControl, 'no-store')
  assert.deepEqual(first.body.entry, { ...summary, savedAt })
  const googleSession = { cookie: googleUser.cookie, sessionTag: googleUser.sessionTag }
  const passwordSession = { cookie: passwordUser.cookie, sessionTag: passwordUser.sessionTag }
  assert.deepEqual((await app.history(googleSession)).body, { entries: [], nextCursor: null })

  const update = { ...summary, potentialSavingsCents: 9000 }
  const passwordByEmail = await app.login(account.email)
  await app.history({ ...passwordByEmail, body: update })
  const ownList = await app.history(passwordSession)
  assert.deepEqual(ownList.body, { entries: [{ ...update, savedAt }], nextCursor: null })

  await app.history({ ...googleSession, body: summary })
  const googleRenamed = await app.google('renamed-user')
  assert.deepEqual((await app.history({ cookie: googleRenamed.cookie, sessionTag: googleRenamed.sessionTag })).body.entries, [{ ...summary, savedAt }])
  assert.deepEqual((await app.history(passwordSession)).body.entries, [{ ...update, savedAt }])
})

test('history rejects a stale tab context after a different account replaces the cookie', async (t) => {
  const app = await serverFor(t)
  const staleTab = await app.login(account.username)
  const differentAccount = await app.google('first-login')
  assert.notEqual(staleTab.sessionTag, differentAccount.sessionTag)
  await app.history({ ...differentAccount, body: summary })
  const mismatch = { cookie: differentAccount.cookie, sessionTag: staleTab.sessionTag }
  const attemptedRead = await app.history(mismatch)
  assert.equal(attemptedRead.status, 409)
  assert.match(attemptedRead.body.error, /Recargá/)
  assert.equal(Object.hasOwn(attemptedRead.body, 'entries'), false)
  const attemptedWrite = await app.history({ ...mismatch, body: { ...summary, potentialSavingsCents: 0, selectedSavingsCents: 0 } })
  assert.equal(attemptedWrite.status, 409)
  assert.equal((await app.history({ cookie: differentAccount.cookie })).status, 409)
  const current = await app.history({ cookie: differentAccount.cookie, sessionTag: differentAccount.sessionTag })
  assert.deepEqual(current.body.entries, [{ ...summary, savedAt }])
})

test('history rejects unauthenticated requests, legacy Google sessions, forbidden roles and foreign writes', async (t) => {
  let now = timestamp
  const app = await serverFor(t, { clock: () => now })
  assert.equal((await app.history()).status, 401)
  const googleUser = await app.google('first-login')
  const { sessionTag: _unused, ...legacyUser } = googleUser.body.user
  const legacy = Buffer.from(JSON.stringify(legacyUser)).toString('base64url')
  const signature = createHmac('sha256', Buffer.from(env.SAASGUARD_SESSION_SECRET, 'hex')).update(legacy).digest('base64url')
  const needsLogin = await app.history({ cookie: 'saasguard_session=' + legacy + '.' + signature })
  assert.equal(needsLogin.status, 401)
  assert.match(needsLogin.body.error, /Volvé a iniciar sesión/)
  const { cookie: viewerCookie, sessionTag: viewerTag } = await app.login(viewer.username)
  assert.equal((await app.history({ cookie: viewerCookie, sessionTag: viewerTag })).status, 200)
  assert.equal((await app.history({ cookie: viewerCookie, sessionTag: viewerTag, body: summary })).status, 403)
  const { cookie: writerCookie, sessionTag: writerTag } = await app.login(account.username)
  assert.equal((await app.history({ cookie: writerCookie, sessionTag: writerTag, body: summary, requestOrigin: 'https://other.example.test' })).status, 403)
  assert.equal((await app.history({ cookie: writerCookie, sessionTag: writerTag, method: 'POST' })).status, 405)
  now += 8 * 60 * 60 * 1000
  assert.equal((await app.history({ cookie: writerCookie, sessionTag: writerTag })).status, 401)
})

test('history accepts zero candidates and rejects raw data and inconsistent summaries', async (t) => {
  const app = await serverFor(t)
  const { cookie, sessionTag } = await app.login(account.username)
  const cases = [
    { ...summary, owner: 'another-user' },
    { ...summary, csv: 'synthetic-csv-text' },
    { ...summary, providers: ['fixture-field@example.test'] },
    { ...summary, providers: ['Slack', 'Slack'] },
    { ...summary, potentialSavingsCents: 2 ** 53 },
    { ...summary, selectedCount: 0 },
    { ...summary, unknownCostCount: 7 },
  ]
  for (const body of cases) assert.equal((await app.history({ cookie, sessionTag, body })).status, 400)
  const zero = {
    ...summary, potentialSavingsCents: 0, selectedSavingsCents: 0,
    candidateCount: 0, selectedCount: 0, unknownCostCount: 0, selectedUnknownCostCount: 0,
  }
  assert.equal((await app.history({ cookie, sessionTag, body: zero })).status, 200)
  assert.equal((await app.history({ cookie, sessionTag }, 'bad-cursor')).status, 400)
})

test('history paginates entries with identical timestamps without losing a record', async (t) => {
  const app = await serverFor(t)
  const { cookie, sessionTag } = await app.login(account.username)
  const expected = new Set()
  for (let i = 0; i < 52; i += 1) {
    const auditId = randomUUID()
    expected.add(auditId)
    const saved = await app.history({ cookie, sessionTag, body: { ...summary, auditId } })
    assert.equal(saved.status, 200)
  }
  const first = await app.history({ cookie, sessionTag })
  assert.equal(first.body.entries.length, 50)
  assert.equal(typeof first.body.nextCursor, 'string')
  const next = await app.history({ cookie, sessionTag }, first.body.nextCursor)
  assert.equal(next.body.nextCursor, null)
  assert.equal(next.body.entries.length, 2)
  assert.deepEqual(new Set([...first.body.entries, ...next.body.entries].map((entry) => entry.auditId)), expected)
})

test('missing persistence leaves sign-in available and makes the history API unavailable', async (t) => {
  const app = await serverFor(t, { store: null })
  const login = await app.login(account.username)
  assert.equal(login.status, 200)
  assert.equal((await app.history({ cookie: login.cookie, sessionTag: login.sessionTag })).status, 503)
})

test('Neon persists and isolates a synthetic audit across server instances',
  { skip: process.env.SAASGUARD_TEST_NEON !== '1' }, async (t) => {
    const databaseUrl = process.env.DATABASE_URL
    assert.ok(databaseUrl, 'Dedicated DATABASE_URL is required')
    const sql = neon(databaseUrl)
    const subject = 'synthetic-history-check-' + randomUUID()
    const owner = createHash('sha256').update(JSON.stringify(['saasguard-history:v1', 'google', subject])).digest('hex')
    const saved = { ...summary, auditId: randomUUID() }
    t.after(async () => {
      await sql`DELETE FROM savings_history WHERE owner_key = ${owner} AND audit_id = ${saved.auditId}`
    })
    const options = { store: null, config: { ...env, DATABASE_URL: databaseUrl }, subject }
    const writingApp = await serverFor(t, options)
    const { cookie, sessionTag } = await writingApp.google('first-login')
    const result = await writingApp.history({ cookie, sessionTag, body: saved })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.entry, { ...saved, savedAt: result.body.entry.savedAt })

    const readingApp = await serverFor(t, options)
    const otherAccount = await readingApp.login(account.username)
    assert.deepEqual((await readingApp.history({ cookie: otherAccount.cookie, sessionTag: otherAccount.sessionTag })).body.entries, [])
    const updated = await readingApp.history({ cookie, sessionTag, body: { ...saved, potentialSavingsCents: 8900 } })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.entry.savedAt, result.body.entry.savedAt)
    assert.deepEqual((await readingApp.history({ cookie, sessionTag })).body.entries, [updated.body.entry])
  })
