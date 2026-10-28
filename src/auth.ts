/**
 * Sign-in for the academic MVP: username/email and password against synthetic test users, or
 * Google. The app has no backend, so everything is checked in the browser: the Google ID token
 * is decoded and validated (issuer, audience, expiry, verified email, allowed account) but its
 * signature is not verified, and the test users ship in the bundle. This identifies who operates
 * the app and selects their permissions; it is not server-side authorization. Only the
 * operator's profile is kept, never personnel data.
 */
import { isRole, type Role } from './roles'
import { TEST_USERS, type LocalUser } from './users'

export interface SessionUser {
  email: string
  name: string
  role: Role
  method: 'password' | 'google'
  username?: string
  domain?: string
  /** Epoch milliseconds when the session expires. */
  expiresAt: number
}

export interface GoogleConfig {
  clientId: string
  /** Lower-case email → role. */
  allowedEmails: Record<string, Role>
  /** Any verified account of this Google Workspace domain enters with read-only access. */
  allowedDomain?: string
}

export const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
export const USER_STORAGE_KEY = 'saasguard.sessionUser'
export const REMEMBER_KEY = 'saasguard.rememberedUser'
export const PASSWORD_SESSION_MS = 8 * 60 * 60 * 1000
export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos.'

export function parseAllowedEmails(value: string | undefined): Record<string, Role> {
  const allowed: Record<string, Role> = {}
  for (const entry of (value ?? '').split(',')) {
    const [rawEmail, rawRole = 'viewer'] = entry.split(':')
    const email = rawEmail?.trim().toLowerCase()
    const role = rawRole.trim().toLowerCase()
    if (email && email.includes('@') && isRole(role)) allowed[email] = role
  }
  return allowed
}

export function googleConfig(env: Record<string, string | undefined> = import.meta.env): GoogleConfig | null {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim()
  if (!clientId) return null
  const allowedDomain = env.VITE_GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase()
  return { clientId, allowedEmails: parseAllowedEmails(env.VITE_GOOGLE_ALLOWED_EMAILS), allowedDomain: allowedDomain || undefined }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function signInWithPassword(
  identifier: string, password: string, now = Date.now(), users: readonly LocalUser[] = TEST_USERS,
): Promise<SessionUser> {
  const id = identifier.trim().toLowerCase()
  if (!id || !password) throw new Error('Ingresá tu usuario o email y tu contraseña.')
  const user = users.find((candidate) => candidate.username === id || candidate.email === id)
  // Hash even when the user does not exist, so both failures take the same path.
  const hash = await sha256Hex(`${user?.salt ?? 'no-user'}:${password}`)
  if (!user || hash !== user.passwordHash) throw new Error(INVALID_CREDENTIALS)
  return {
    email: user.email, name: user.name, role: user.role, method: 'password', username: user.username,
    expiresAt: now + PASSWORD_SESSION_MS,
  }
}

/** Counts failed password attempts in memory and blocks new ones for a while after too many. */
export class AttemptLimiter {
  private failures = 0
  private lockedUntil = 0

  constructor(private readonly max = MAX_ATTEMPTS, private readonly lockoutMs = LOCKOUT_MS) {}

  remainingLockMs(now = Date.now()): number {
    return Math.max(0, this.lockedUntil - now)
  }

  fail(now = Date.now()): void {
    this.failures += 1
    if (this.failures >= this.max) {
      this.lockedUntil = now + this.lockoutMs
      this.failures = 0
    }
  }

  succeed(): void {
    this.failures = 0
    this.lockedUntil = 0
  }
}

function decodePayload(credential: string): Record<string, unknown> {
  const parts = credential.split('.')
  if (parts.length !== 3 || !parts[1]) throw new Error('Google devolvió una credencial con un formato inesperado.')
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload')
    return payload as Record<string, unknown>
  } catch {
    throw new Error('Google devolvió una credencial con un formato inesperado.')
  }
}

export function parseGoogleCredential(credential: string, config: GoogleConfig, now = Date.now()): SessionUser {
  const payload = decodePayload(credential)
  if (typeof payload.iss !== 'string' || !ISSUERS.has(payload.iss)) throw new Error('La credencial no fue emitida por Google.')
  if (payload.aud !== config.clientId) throw new Error('La credencial corresponde a otra aplicación.')
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) throw new Error('La sesión de Google venció. Volvé a iniciar sesión.')
  if (typeof payload.email !== 'string' || !payload.email.includes('@')) throw new Error('Google no informó un email para esta cuenta.')
  if (payload.email_verified !== true) throw new Error('La cuenta de Google no tiene el email verificado.')
  const email = payload.email.trim().toLowerCase()
  const domain = typeof payload.hd === 'string' ? payload.hd.toLowerCase() : undefined
  const role = config.allowedEmails[email]
    ?? (config.allowedDomain && domain === config.allowedDomain ? 'viewer' : undefined)
  if (!role) throw new Error(`La cuenta ${email} no tiene acceso a SaaSGuard. Pedile a quien administra la app que la habilite.`)
  return {
    email,
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email,
    role,
    method: 'google',
    domain,
    expiresAt: payload.exp * 1000,
  }
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return typeof user.email === 'string' && typeof user.name === 'string' && isRole(user.role)
    && (user.method === 'password' || user.method === 'google')
    && typeof user.expiresAt === 'number' && Number.isFinite(user.expiresAt)
    && (user.username === undefined || typeof user.username === 'string')
    && (user.domain === undefined || typeof user.domain === 'string')
}

/**
 * The stored role is not trusted: it is recomputed from the test users or the Google allowlist,
 * so editing sessionStorage cannot raise permissions or keep an account that lost access.
 */
export function readStoredUser(
  google: GoogleConfig | null, now = Date.now(), storage: Storage | undefined = globalThis.sessionStorage,
  users: readonly LocalUser[] = TEST_USERS,
): SessionUser | null {
  try {
    const raw = storage?.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    const user: unknown = JSON.parse(raw)
    let role: Role | undefined
    if (isSessionUser(user) && user.expiresAt > now) {
      if (user.method === 'password') role = users.find((u) => u.username === user.username && u.email === user.email)?.role
      else if (google) role = google.allowedEmails[user.email]
        ?? (google.allowedDomain && user.domain === google.allowedDomain ? 'viewer' : undefined)
    }
    if (!role || !isSessionUser(user)) {
      storage?.removeItem(USER_STORAGE_KEY)
      return null
    }
    return { ...user, role }
  } catch {
    return null
  }
}

export function storeUser(user: SessionUser, storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Without storage the user stays signed in until the tab reloads.
  }
}

export function clearStoredUser(storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.removeItem(USER_STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** «Recordar mis datos» keeps only the username or email, never the password. */
export function readRememberedIdentifier(storage: Storage | undefined = globalThis.localStorage): string {
  try {
    return storage?.getItem(REMEMBER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberIdentifier(identifier: string | null, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    if (identifier) storage?.setItem(REMEMBER_KEY, identifier.trim())
    else storage?.removeItem(REMEMBER_KEY)
  } catch {
    // Remembering is a convenience only.
  }
}
