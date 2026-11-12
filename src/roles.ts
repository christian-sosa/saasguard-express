export type Role = 'admin' | 'it' | 'people' | 'finance' | 'viewer'

export interface Permissions {
  /** Upload the payroll and SaaS exports of a real audit (the demo is always available). */
  load: boolean
  /** Confirm a case into the checklist. */
  confirm: boolean
  /** Keep an account as an exception or leave a note to review with HR. */
  annotate: boolean
  /** Enter or correct the monthly USD cost of a candidate. */
  editCost: boolean
  exportXlsx: boolean
  exportPdf: boolean
  exportSnapshot: boolean
  /** Register a real pilot run. */
  pilot: boolean
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administración',
  it: 'IT',
  people: 'People Operations',
  finance: 'Finanzas',
  viewer: 'Sólo lectura',
}

const NONE: Permissions = {
  load: false, confirm: false, annotate: false, editCost: false, exportXlsx: false, exportPdf: false, exportSnapshot: false, pilot: false,
}

export const PERMISSIONS: Record<Role, Permissions> = {
  admin: { load: true, confirm: true, annotate: true, editCost: true, exportXlsx: true, exportPdf: true, exportSnapshot: true, pilot: true },
  it: { ...NONE, load: true, confirm: true, annotate: true, exportXlsx: true, exportSnapshot: true },
  people: { ...NONE, load: true, annotate: true, exportSnapshot: true },
  finance: { ...NONE, load: true, confirm: true, editCost: true, exportXlsx: true, exportPdf: true, exportSnapshot: true },
  viewer: NONE,
}

/** Used when the app runs without a signed-in user (tests and embedded previews). */
export const FULL_ACCESS = PERMISSIONS.admin

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && Object.hasOwn(ROLE_LABELS, value)
}
