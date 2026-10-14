import { describe, expect, it } from 'vitest'
import type { Candidate, License } from './domain'
import { auditStamp, providerSummary, reviewText } from './labels'

const candidate = (patch: Partial<Candidate> = {}): Candidate => ({
  id: '["slack","ana@example.test"]', email: 'ana@example.test', name: 'Ana', provider: 'Slack', plan: 'Std', cost: 5, review: 'pending', ...patch,
})
const license = (provider: string, email: string): License => ({ id: JSON.stringify([provider.toLowerCase(), email]), email, name: '', provider, plan: '', cost: null })

describe('etiqueta de revisión (HU-08)', () => {
  it('un caso sin tocar sigue como «Por revisar»', () => {
    expect(reviewText(candidate())).toBe('Por revisar')
  })
  it('un caso pendiente con nota se muestra como «Revisar con RRHH»', () => {
    expect(reviewText(candidate({ note: 'Nombre similar en nómina' }))).toBe('Revisar con RRHH')
  })
  it('una nota vacía o de espacios no cambia la marca', () => {
    expect(reviewText(candidate({ note: '   ' }))).toBe('Por revisar')
  })
  it('conserva las etiquetas de los casos ya resueltos aunque tengan nota', () => {
    expect(reviewText(candidate({ review: 'confirmed', note: 'ok' }))).toBe('Al checklist')
    expect(reviewText(candidate({ review: 'retained', note: 'ok' }))).toBe('Mantener cuenta')
  })
})

describe('proveedores de la exportación (HU-02)', () => {
  it('lista cada proveedor una sola vez y en orden alfabético', () => {
    const items = [license('Slack', 'a@example.test'), license('Jira', 'a@example.test'), license('Slack', 'b@example.test')]
    expect(providerSummary(items)).toBe('Jira, Slack')
  })
  it('devuelve vacío cuando no hay licencias', () => {
    expect(providerSummary([])).toBe('')
  })
})

describe('sello de la auditoría (HU-02)', () => {
  it('muestra fecha y hora locales aclarando que no es fecha de egreso', () => {
    const text = auditStamp('2026-10-14T15:32:00.000Z')
    expect(text).toContain('Fecha de auditoría')
    expect(text).toContain('no es fecha de egreso')
    expect(text).toMatch(/14\/10\/2026/)
  })
  it('no inventa una fecha cuando el valor es inválido', () => {
    expect(auditStamp('no-es-fecha')).toBe('')
  })
})
