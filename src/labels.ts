import type { Candidate, License } from './domain'

const reviewLabels: Record<Candidate['review'], string> = {
  pending: 'Por revisar',
  confirmed: 'Al checklist',
  retained: 'Mantener cuenta',
}

/** A pending case that already has a note was saved to review with RRHH; show that mark in the results table. */
export function reviewText(candidate: Pick<Candidate, 'review' | 'note'>): string {
  if (candidate.review === 'pending' && candidate.note?.trim()) return 'Revisar con RRHH'
  return reviewLabels[candidate.review]
}

export function providerSummary(licenses: Pick<License, 'provider'>[]): string {
  return [...new Set(licenses.map(license => license.provider))].sort((a, b) => a.localeCompare(b, 'es')).join(', ')
}

/** The audit date is when the session was created. It is never an employee termination date. */
export function auditStamp(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  const text = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
  return `Fecha de auditoría: ${text} (no es fecha de egreso)`
}
