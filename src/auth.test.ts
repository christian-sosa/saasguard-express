import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AttemptLimiter, PASSWORD_SESSION_MS, USER_STORAGE_KEY, clearStoredUser, googleConfig, parseAllowedEmails,
  parseGoogleCredential, readRememberedIdentifier, readStoredUser, rememberIdentifier, signInWithPassword, storeUser,
  type GoogleConfig,
} from './auth';
import { PERMISSIONS } from './roles';
import { TEST_USERS, type LocalUser } from './users';

const NOW = Date.parse('2026-10-28T15:00:00.000Z');
const google: GoogleConfig = {
  clientId: 'client-123.apps.googleusercontent.com',
  allowedEmails: { 'owner@gmail.test': 'admin' },
};

function localUser(username: string, password: string, role: LocalUser['role']): LocalUser {
  const salt = `salt-${username}`;
  return {
    username, email: `${username}@empresa.test`, name: username, role, salt,
    passwordHash: createHash('sha256').update(`${salt}:${password}`).digest('hex'),
  };
}
const users = [localUser('ana.it', 'Clave-Ana-1', 'it'), localUser('beto.fin', 'Clave-Beto-2', 'finance')];

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com', aud: google.clientId, exp: NOW / 1000 + 3600,
    email: 'Owner@Gmail.TEST', email_verified: true, name: 'Dueño Pérez', ...overrides,
  };
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('password sign-in', () => {
  it('accepts the username or the email, ignoring case and outer spaces', async () => {
    const byName = await signInWithPassword(' ANA.IT ', 'Clave-Ana-1', NOW, users);
    expect(byName).toEqual({
      email: 'ana.it@empresa.test', name: 'ana.it', role: 'it', method: 'password', username: 'ana.it',
      expiresAt: NOW + PASSWORD_SESSION_MS,
    });
    expect((await signInWithPassword('beto.fin@empresa.test', 'Clave-Beto-2', NOW, users)).role).toBe('finance');
  });

  it('gives the same message for a wrong password and an unknown user, and asks for both fields', async () => {
    await expect(signInWithPassword('ana.it', 'clave-ana-1', NOW, users)).rejects.toThrow('Usuario o contraseña incorrectos.');
    await expect(signInWithPassword('nadie', 'Clave-Ana-1', NOW, users)).rejects.toThrow('Usuario o contraseña incorrectos.');
    await expect(signInWithPassword('', 'x', NOW, users)).rejects.toThrow('Ingresá tu usuario o email y tu contraseña.');
    await expect(signInWithPassword('ana.it', '', NOW, users)).rejects.toThrow('Ingresá tu usuario o email y tu contraseña.');
  });

  it('ships one synthetic test user per role, with unique usernames and test domains', () => {
    expect(new Set(TEST_USERS.map((u) => u.role))).toEqual(new Set(Object.keys(PERMISSIONS)));
    expect(new Set(TEST_USERS.map((u) => u.username)).size).toBe(TEST_USERS.length);
    for (const user of TEST_USERS) {
      expect(user.email.endsWith('.test')).toBe(true);
      expect(user.passwordHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('locks new attempts for a while after five failures and resets after a success', () => {
    const limiter = new AttemptLimiter(5, 30_000);
    for (let i = 0; i < 4; i += 1) limiter.fail(NOW);
    expect(limiter.remainingLockMs(NOW)).toBe(0);
    limiter.fail(NOW);
    expect(limiter.remainingLockMs(NOW + 1_000)).toBe(29_000);
    expect(limiter.remainingLockMs(NOW + 30_000)).toBe(0);
    limiter.fail(NOW + 30_000);
    limiter.succeed();
    expect(limiter.remainingLockMs(NOW + 30_000)).toBe(0);
  });
});

describe('role permissions', () => {
  it('lets IT, Finanzas and admin confirm cases, only Finanzas and admin edit costs, and the viewer nothing', () => {
    expect(PERMISSIONS.it).toMatchObject({ load: true, confirm: true, editCost: false, exportXlsx: true, exportPdf: false });
    expect(PERMISSIONS.people).toMatchObject({ load: true, confirm: false, annotate: true, exportXlsx: false });
    expect(PERMISSIONS.finance).toMatchObject({ confirm: true, editCost: true, exportXlsx: true, exportPdf: true });
    expect(Object.values(PERMISSIONS.viewer).every((allowed) => !allowed)).toBe(true);
    expect(Object.values(PERMISSIONS.admin).every(Boolean)).toBe(true);
  });
});

describe('Google sign-in', () => {
  it('is configured only with a client ID and reads the allowlist with roles', () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({
      VITE_GOOGLE_CLIENT_ID: ' abc ', VITE_GOOGLE_ALLOWED_EMAILS: ' Owner@Gmail.test:admin , ana@x.test ',
      VITE_GOOGLE_ALLOWED_DOMAIN: ' Empresa.TEST ',
    })).toEqual({
      clientId: 'abc', allowedEmails: { 'owner@gmail.test': 'admin', 'ana@x.test': 'viewer' }, allowedDomain: 'empresa.test',
    });
    expect(parseAllowedEmails('bad, x@y.test:superuser, ok@y.test:finance')).toEqual({ 'ok@y.test': 'finance' });
  });

  it('admits an allowlisted account with its role', () => {
    expect(parseGoogleCredential(token(claims()), google, NOW)).toEqual({
      email: 'owner@gmail.test', name: 'Dueño Pérez', role: 'admin', method: 'google', domain: undefined,
      expiresAt: NOW + 3_600_000,
    });
  });

  it('rejects accounts without access and invalid tokens', () => {
    expect(() => parseGoogleCredential(token(claims({ email: 'otro@gmail.test' })), google, NOW)).toThrow('no tiene acceso');
    const cases: [Record<string, unknown>, string][] = [
      [{ iss: 'https://evil.example' }, 'no fue emitida por Google'],
      [{ aud: 'other-client' }, 'otra aplicación'],
      [{ exp: NOW / 1000 }, 'venció'],
      [{ email_verified: false }, 'no tiene el email verificado'],
    ];
    for (const [override, message] of cases) {
      expect(() => parseGoogleCredential(token(claims(override)), google, NOW)).toThrow(message);
    }
    expect(() => parseGoogleCredential('a.###.c', google, NOW)).toThrow('formato inesperado');
  });

  it('gives read-only access to any account of the allowed domain', () => {
    const config = { ...google, allowedDomain: 'empresa.test' };
    const user = parseGoogleCredential(token(claims({ email: 'x@empresa.test', hd: 'empresa.test' })), config, NOW);
    expect(user.role).toBe('viewer');
  });
});

describe('stored session', () => {
  it('restores a password session until it expires', async () => {
    const storage = new MemoryStorage();
    const user = await signInWithPassword('ana.it', 'Clave-Ana-1', NOW, users);
    storeUser(user, storage);
    expect(readStoredUser(google, NOW, storage, users)).toEqual(user);
    expect(readStoredUser(google, user.expiresAt, storage, users)).toBeNull();
    expect(storage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('recomputes the role instead of trusting a tampered or revoked session', async () => {
    const storage = new MemoryStorage();
    const user = await signInWithPassword('ana.it', 'Clave-Ana-1', NOW, users);
    storeUser({ ...user, role: 'admin' }, storage);
    expect(readStoredUser(google, NOW, storage, users)?.role).toBe('it');
    storeUser({ ...user, username: 'nadie' }, storage);
    expect(readStoredUser(google, NOW, storage, users)).toBeNull();
    storeUser(parseGoogleCredential(token(claims()), google, NOW), storage);
    expect(readStoredUser({ ...google, allowedEmails: {} }, NOW, storage, users)).toBeNull();
    storage.setItem(USER_STORAGE_KEY, 'not json');
    expect(readStoredUser(google, NOW, storage, users)).toBeNull();
    storeUser(user, storage);
    clearStoredUser(storage);
    expect(readStoredUser(google, NOW, storage, users)).toBeNull();
  });

  it('remembers only the identifier, never the password', () => {
    const storage = new MemoryStorage();
    rememberIdentifier(' ana.it ', storage);
    expect(readRememberedIdentifier(storage)).toBe('ana.it');
    expect(storage.length).toBe(1);
    rememberIdentifier(null, storage);
    expect(readRememberedIdentifier(storage)).toBe('');
  });
});
