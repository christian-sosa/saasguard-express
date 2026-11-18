import { createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { promisify } from 'node:util'
import { OAuth2Client } from 'google-auth-library'
import { json, readBody, RequestError, sameOrigin } from './http.js'

const deriveKey = promisify(scrypt)
const roles = new Set(['admin', 'it', 'people', 'finance', 'viewer'])
const cookieName = 'saasguard_session'
const sessionMs = 8 * 60 * 60 * 1000
const lockoutMs = 30_000
const maxFailures = 5
const maxTrackedAddresses = 256
const dummySalt = Buffer.alloc(16)
const dummyHash = Buffer.alloc(64)
const invalidPassword = 'Usuario o contraseña incorrectos.'
const invalidGoogle = 'No pudimos iniciar sesión con Google. Verificá que la cuenta tenga acceso.'
const unavailable = 'El inicio de sesión no está disponible. Volvé a intentar más tarde.'

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function decodeHex(value) {
  return typeof value === 'string' && /^(?:[a-fA-F0-9]{2})+$/.test(value)
    ? Buffer.from(value, 'hex')
    : null
}

function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(email)
}

function validGoogleSubject(value) {
  return typeof value === 'string' && /^[\x21-\x7e]{1,255}$/.test(value)
}

function readPasswordUsers(raw) {
  const accounts = JSON.parse(raw || '[]')
  if (!Array.isArray(accounts)) throw new Error('Invalid password users')
  const byIdentifier = new Map()
  for (const account of accounts) {
    const username = normalized(account?.username)
    const email = normalized(account?.email)
    const name = typeof account?.name === 'string' ? account.name.trim() : ''
    const role = account?.role
    const salt = decodeHex(account?.salt)
    const hash = decodeHex(account?.hash)
    if (!username || username.length > 254 || !validEmail(email) || !name || name.length > 160
      || !roles.has(role) || !salt || hash?.length !== 64
      || byIdentifier.has(username) || byIdentifier.has(email)) {
      throw new Error('Invalid password account')
    }
    const user = { username, email, name, role, salt, hash }
    byIdentifier.set(username, user)
    byIdentifier.set(email, user)
  }
  return byIdentifier
}

function readConfig(env) {
  const key = decodeHex(env.SAASGUARD_SESSION_SECRET?.trim())
  if (!key || key.length < 32) return null

  let passwordUsers
  try {
    passwordUsers = readPasswordUsers(env.SAASGUARD_PASSWORD_USERS)
  } catch {
    return null
  }

  const allowedEmails = new Map()
  for (const entry of (env.SAASGUARD_GOOGLE_ALLOWED_EMAILS ?? '').split(',')) {
    const [rawEmail, rawRole = 'viewer', extra] = entry.split(':')
    const email = normalized(rawEmail)
    const role = normalized(rawRole)
    if (extra === undefined && validEmail(email) && roles.has(role)) allowedEmails.set(email, role)
  }
  const allowedDomain = normalized(env.SAASGUARD_GOOGLE_ALLOWED_DOMAIN)
  const clientId = env.SAASGUARD_GOOGLE_CLIENT_ID?.trim()
  const google = clientId && (allowedEmails.size || allowedDomain)
    ? { clientId, allowedEmails, allowedDomain }
    : null

  return { key, passwordUsers, google, onVercel: env.VERCEL === '1' && env.VERCEL_ENV !== 'development' }
}

function verifyGoogleToken(idToken, audience) {
  return googleClient.verifyIdToken({ idToken, audience }).then((ticket) => ticket.getPayload())
}

const googleClient = new OAuth2Client()

function googleRole(google, email, domain) {
  return google?.allowedEmails.get(email)
    ?? (google?.allowedDomain && google.allowedDomain === domain ? 'viewer' : undefined)
}

function passwordSession(account, expiresAt) {
  return {
    email: account.email,
    name: account.name,
    role: account.role,
    method: 'password',
    username: account.username,
    expiresAt,
  }
}

function sessionSignature(encoded, key) {
  return createHmac('sha256', key).update(encoded).digest('base64url')
}

function signedSessionTag(value) {
  return createHash('sha256').update('saasguard:session-context:v1\0').update(value).digest('base64url')
}

function writeCookie(res, value, maxAge, secure) {
  const secureFlag = secure ? '; Secure' : ''
  res.setHeader('Set-Cookie', cookieName + '=' + value + '; Max-Age=' + maxAge
    + '; Path=/; HttpOnly; SameSite=Lax' + secureFlag)
}

function writeSession(res, user, now, key, secure) {
  const encoded = Buffer.from(JSON.stringify(user)).toString('base64url')
  const value = encoded + '.' + sessionSignature(encoded, key)
  writeCookie(res, value, Math.floor((user.expiresAt - now) / 1000), secure)
  return { user, sessionTag: signedSessionTag(value) }
}

function readSession(req, config, now) {
  const cookie = typeof req.headers.cookie === 'string' ? req.headers.cookie : ''
  const entries = cookie.split(';').map((entry) => entry.trim()).filter((entry) => entry.startsWith(cookieName + '='))
  if (entries.length !== 1 || entries[0].length > 4096) return null

  const value = entries[0].slice(cookieName.length + 1)
  const [encoded, signature, extra] = value.split('.')
  if (extra !== undefined || !encoded || !signature || !/^[\w-]+$/.test(encoded) || !/^[\w-]{43}$/.test(signature)) return null
  const expected = sessionSignature(encoded, config.key)
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null

  let user
  try {
    user = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!user || !Number.isFinite(user.expiresAt) || user.expiresAt <= now) return null

  if (user.method === 'password') {
    const account = config.passwordUsers.get(user.username)
    if (!account || account.email !== user.email) return null
    return { user: passwordSession(account, user.expiresAt), sessionTag: signedSessionTag(value) }
  }
  if (user.method === 'google') {
    const role = googleRole(config.google, user.email, user.domain)
    return role ? { user: { ...user, role }, sessionTag: signedSessionTag(value) } : null
  }
  return null
}

function secureRequest(req, config) {
  return config.onVercel || Boolean(req.socket?.encrypted) || req.headers['x-forwarded-proto'] === 'https'
}

export function createSessionReader({ env = process.env, now = Date.now } = {}) {
  const config = readConfig(env)
  if (!config) return null
  return (req) => ({ ...readSession(req, config, now()), secure: secureRequest(req, config) })
}

function publicUser(session) {
  if (!session) return null
  const { googleSubject, ...profile } = session.user
  return { ...profile, sessionTag: session.sessionTag }
}

function requestAddress(req, onVercel) {
  const forwarded = req.headers['x-vercel-forwarded-for']
  const address = onVercel && typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ''
  return isIP(address) ? address : req.socket?.remoteAddress ?? 'unknown'
}

function getAttempt(attempts, address, now) {
  for (const [trackedAddress, entry] of attempts) {
    if (!entry.pending && entry.until <= now) attempts.delete(trackedAddress)
  }
  const existing = attempts.get(address)
  if (existing) {
    if (existing.until <= now) {
      existing.failures = 0
      existing.until = now + lockoutMs
    }
    return existing
  }
  if (attempts.size >= maxTrackedAddresses) return null
  const entry = { failures: 0, pending: false, until: now + lockoutMs }
  attempts.set(address, entry)
  return entry
}

export function createAuthHandler({ env = process.env, now = Date.now, verifyGoogle = verifyGoogleToken } = {}) {
  const config = readConfig(env)
  const attempts = new Map()
  let pendingPasswords = 0

  async function authenticatePassword(req, res, body) {
    const id = normalized(body.identifier)
    const password = body.password
    if (!id || id.length > 254 || typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) {
      throw new RequestError(400, 'Ingresá un usuario y una contraseña válidos.')
    }
    const address = requestAddress(req, config.onVercel)
    const attempt = getAttempt(attempts, address, now())
    if (!attempt || attempt.pending || attempt.failures >= maxFailures || pendingPasswords >= 16) {
      const retrySeconds = attempt?.failures >= maxFailures
        ? Math.max(1, Math.ceil((attempt.until - now()) / 1000))
        : 1
      res.setHeader('Retry-After', String(retrySeconds))
      throw new RequestError(429, 'Demasiados intentos. Volvé a intentar en unos segundos.')
    }

    attempt.pending = true
    pendingPasswords += 1
    const account = config.passwordUsers.get(id)
    try {
      const derived = await deriveKey(password, account?.salt ?? dummySalt, 64)
      const matches = timingSafeEqual(derived, account?.hash ?? dummyHash)
      if (!account || !matches) {
        attempt.failures += 1
        if (attempt.failures === maxFailures) attempt.until = now() + lockoutMs
        throw new RequestError(401, invalidPassword)
      }
      attempts.delete(address)
      return passwordSession(account, now() + sessionMs)
    } finally {
      attempt.pending = false
      pendingPasswords -= 1
    }
  }

  async function authenticateGoogle(credential) {
    if (!config.google || typeof credential !== 'string' || !credential) {
      throw new RequestError(401, invalidGoogle)
    }
    let payload
    try {
      payload = await verifyGoogle(credential, config.google.clientId)
    } catch {
      throw new RequestError(401, invalidGoogle)
    }

    const timestamp = now()
    const email = normalized(payload?.email)
    const domain = normalized(payload?.hd) || undefined
    const googleSubject = payload?.sub
    const expiresAt = Math.min(timestamp + sessionMs, payload?.exp * 1000)
    const role = googleRole(config.google, email, domain)
    if (!validGoogleSubject(googleSubject) || payload?.email_verified !== true || !validEmail(email) || !role || typeof payload.exp !== 'number'
      || !Number.isFinite(expiresAt) || expiresAt <= timestamp) {
      throw new RequestError(401, invalidGoogle)
    }
    const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 160) : ''
    return { email, name: name || email, role, method: 'google', domain, googleSubject, expiresAt }
  }

  return async function authHandler(req, res) {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST')
        throw new RequestError(405, 'Método no permitido.')
      }
      if (!config) throw new RequestError(503, unavailable)

      const secure = secureRequest(req, config)
      if (req.method === 'GET') {
        return json(res, 200, {
          user: publicUser(readSession(req, config, now())),
          googleClientId: config.google?.clientId ?? null,
        })
      }
      if (!sameOrigin(req, secure)) throw new RequestError(403, 'Origen de la solicitud no permitido.')
      const body = await readBody(req, 'La solicitud de inicio de sesión no es válida.')
      if (body.action === 'logout') {
        writeCookie(res, '', 0, secure)
        return json(res, 200, { user: null })
      }

      if (readSession(req, config, now())) {
        throw new RequestError(409, 'Cerrá la sesión actual antes de iniciar otra.')
      }
      let user
      switch (body.action) {
        case 'password':
          user = await authenticatePassword(req, res, body)
          break
        case 'google':
          user = await authenticateGoogle(body.credential)
          break
        default:
          throw new RequestError(400, 'La solicitud de inicio de sesión no es válida.')
      }
      const session = writeSession(res, user, now(), config.key, secure)
      return json(res, 200, { user: publicUser(session) })
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500
      const message = error instanceof RequestError ? error.message : unavailable
      return json(res, status, { error: message })
    }
  }
}
