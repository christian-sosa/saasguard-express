import type { Role } from './roles'

export interface LocalUser {
  username: string
  email: string
  name: string
  role: Role
  salt: string
  /** SHA-256 hex of `${salt}:${password}`. */
  passwordHash: string
}

/**
 * Synthetic test users for the academic MVP. They ship inside the browser bundle, so they are
 * demo accounts, not real credentials: the passwords are listed in docs/usuarios-de-prueba.md.
 */
export const TEST_USERS: readonly LocalUser[] = [
  { username: 'admin', email: 'admin@saasguard.test', name: 'Administración de prueba', role: 'admin', salt: '50daee04ded5889e', passwordHash: 'c12c134037d17deeff4d2c75652c3b00c08fb34b332a0ba9d219db8ed7293be7' },
  { username: 'ignacio.it', email: 'ignacio.it@empresa.test', name: 'Ignacio (IT)', role: 'it', salt: '11b7f4ff575fcfb8', passwordHash: '5da19187f3d656f6df8ab2c81627d04b68c612a365a45eefeb78107fbd51bfe5' },
  { username: 'florencia.rrhh', email: 'florencia.rrhh@empresa.test', name: 'Florencia (People Ops)', role: 'people', salt: 'e29d8906d13adfc3', passwordHash: 'eeb091ebefa97a64e0d5a2052da55cbb9a6d37b4580bda833598c45ae8ea9050' },
  { username: 'gonzalo.finanzas', email: 'gonzalo.finanzas@empresa.test', name: 'Gonzalo (Finanzas)', role: 'finance', salt: 'eaf096db6dd3c487', passwordHash: 'c61bc13c2602a1788913bc64d8ca0eef055bdd957891a401c1e0e92779093fb8' },
  { username: 'lector', email: 'lector@empresa.test', name: 'Lectura de prueba', role: 'viewer', salt: '491408fd278899d4', passwordHash: 'bb389f5fb0de9d46ff29316931ce344ef4712955c1bc83499005233c3d7d8f23' },
]
