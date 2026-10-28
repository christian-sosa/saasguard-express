/**
 * Google sign-in for the academic MVP. The app has no backend, so the ID token is decoded and
 * checked (issuer, audience, expiry, verified email, optional domain) in the browser but its
 * signature is not verified. This identifies who operates the app; it is not server-side
 * authorization. Only the operator's profile is kept, never personnel data.
 */
export interface GoogleUser {
  email: string
  name: string
  picture?: string
  domain?: string
  /** Epoch milliseconds when the Google ID token expires. */
  expiresAt: number
}

export interface AuthConfig {
  clientId: string
  allowedDomain?: string
}

export const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
export const USER_STORAGE_KEY = 'saasguard.googleUser'
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])

export function authConfig(env: Record<string, string | undefined> = import.meta.env): AuthConfig | null {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim()
  if (!clientId) return null
  const allowedDomain = env.VITE_GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase()
  return { clientId, allowedDomain: allowedDomain || undefined }
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

export function parseGoogleCredential(credential: string, config: AuthConfig, now = Date.now()): GoogleUser {
  const payload = decodePayload(credential)
  if (typeof payload.iss !== 'string' || !ISSUERS.has(payload.iss)) throw new Error('La credencial no fue emitida por Google.')
  if (payload.aud !== config.clientId) throw new Error('La credencial corresponde a otra aplicación.')
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) throw new Error('La sesión de Google venció. Volvé a iniciar sesión.')
  if (typeof payload.email !== 'string' || !payload.email.includes('@')) throw new Error('Google no informó un email para esta cuenta.')
  if (payload.email_verified !== true) throw new Error('La cuenta de Google no tiene el email verificado.')
  const email = payload.email.trim().toLowerCase()
  const domain = typeof payload.hd === 'string' ? payload.hd.toLowerCase() : undefined
  if (config.allowedDomain && domain !== config.allowedDomain) {
    throw new Error(`Ingresá con una cuenta de Google Workspace de ${config.allowedDomain}.`)
  }
  return {
    email,
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    domain,
    expiresAt: payload.exp * 1000,
  }
}

function isGoogleUser(value: unknown): value is GoogleUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return typeof user.email === 'string' && typeof user.name === 'string'
    && typeof user.expiresAt === 'number' && Number.isFinite(user.expiresAt)
    && (user.picture === undefined || typeof user.picture === 'string')
    && (user.domain === undefined || typeof user.domain === 'string')
}

/** The profile lives in sessionStorage: it survives a reload of the tab and dies with it. */
export function readStoredUser(config: AuthConfig, now = Date.now(), storage: Storage | undefined = globalThis.sessionStorage): GoogleUser | null {
  try {
    const raw = storage?.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    const user: unknown = JSON.parse(raw)
    const valid = isGoogleUser(user) && user.expiresAt > now
      && (!config.allowedDomain || user.domain === config.allowedDomain)
    if (!valid) {
      storage?.removeItem(USER_STORAGE_KEY)
      return null
    }
    return user
  } catch {
    return null
  }
}

export function storeUser(user: GoogleUser, storage: Storage | undefined = globalThis.sessionStorage): void {
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
