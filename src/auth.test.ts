import { describe, expect, it } from 'vitest';
import {
  authConfig, clearStoredUser, parseGoogleCredential, readStoredUser, storeUser, USER_STORAGE_KEY,
  type AuthConfig,
} from './auth';

const NOW = Date.parse('2026-10-28T15:00:00.000Z');
const config: AuthConfig = { clientId: 'client-123.apps.googleusercontent.com' };

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com', aud: config.clientId, exp: NOW / 1000 + 3600,
    email: 'Ignacio.IT@Example.TEST', email_verified: true, name: 'Ignacio Pérez', hd: 'example.test',
    ...overrides,
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

describe('Google sign-in', () => {
  it('is disabled without a client ID and trims the configured values', () => {
    expect(authConfig({})).toBeNull();
    expect(authConfig({ VITE_GOOGLE_CLIENT_ID: '  ' })).toBeNull();
    expect(authConfig({ VITE_GOOGLE_CLIENT_ID: ' abc ', VITE_GOOGLE_ALLOWED_DOMAIN: ' Example.TEST ' }))
      .toEqual({ clientId: 'abc', allowedDomain: 'example.test' });
  });

  it('reads the operator profile from a valid Google ID token, including accented names', () => {
    expect(parseGoogleCredential(token(claims()), config, NOW)).toEqual({
      email: 'ignacio.it@example.test', name: 'Ignacio Pérez', picture: undefined,
      domain: 'example.test', expiresAt: NOW + 3_600_000,
    });
  });

  it('rejects tokens from another issuer, another app, expired or with an unverified email', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ iss: 'https://evil.example' }, 'no fue emitida por Google'],
      [{ aud: 'other-client' }, 'otra aplicación'],
      [{ exp: NOW / 1000 }, 'venció'],
      [{ email_verified: false }, 'no tiene el email verificado'],
      [{ email: undefined }, 'no informó un email'],
    ];
    for (const [override, message] of cases) {
      expect(() => parseGoogleCredential(token(claims(override)), config, NOW)).toThrow(message);
    }
    expect(() => parseGoogleCredential('not-a-jwt', config, NOW)).toThrow('formato inesperado');
    expect(() => parseGoogleCredential('a.###.c', config, NOW)).toThrow('formato inesperado');
  });

  it('restricts sign-in to the configured Google Workspace domain', () => {
    const restricted = { ...config, allowedDomain: 'empresa.test' };
    expect(() => parseGoogleCredential(token(claims()), restricted, NOW)).toThrow('empresa.test');
    expect(() => parseGoogleCredential(token(claims({ hd: undefined })), restricted, NOW)).toThrow('empresa.test');
    expect(parseGoogleCredential(token(claims({ hd: 'empresa.test' })), restricted, NOW).domain).toBe('empresa.test');
  });

  it('keeps the profile for the tab session only until the token expires', () => {
    const storage = new MemoryStorage();
    const user = parseGoogleCredential(token(claims()), config, NOW);
    storeUser(user, storage);
    expect(readStoredUser(config, NOW, storage)).toEqual(user);
    expect(readStoredUser(config, user.expiresAt, storage)).toBeNull();
    expect(storage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('discards stored profiles that are malformed or from another domain, and clears on sign-out', () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_STORAGE_KEY, '{"email":1}');
    expect(readStoredUser(config, NOW, storage)).toBeNull();
    storage.setItem(USER_STORAGE_KEY, 'not json');
    expect(readStoredUser(config, NOW, storage)).toBeNull();
    const user = parseGoogleCredential(token(claims()), config, NOW);
    storeUser(user, storage);
    expect(readStoredUser({ ...config, allowedDomain: 'empresa.test' }, NOW, storage)).toBeNull();
    storeUser(user, storage);
    clearStoredUser(storage);
    expect(readStoredUser(config, NOW, storage)).toBeNull();
  });
});
