import { describe, expect, it } from 'vitest'
import { argentinaDay, nextArgentinaMidnight } from './retention'

describe('retención por día calendario de Argentina', () => {
  it('usa el día de Argentina, con el cambio exacto a las 03:00 UTC', () => {
    expect(argentinaDay(Date.parse('2026-10-04T02:59:59.999Z'))).toBe('2026-10-03')
    expect(argentinaDay(Date.parse('2026-10-04T03:00:00.000Z'))).toBe('2026-10-04')
    expect(nextArgentinaMidnight(Date.parse('2026-10-04T02:59:59.999Z'))).toBe(Date.parse('2026-10-04T03:00:00.000Z'))
    expect(nextArgentinaMidnight(Date.parse('2026-10-04T03:00:00.000Z'))).toBe(Date.parse('2026-10-05T03:00:00.000Z'))
  })

  it.each([
    ['2026-12-31T23:00:00.000Z', '2027-01-01T03:00:00.000Z'],
    ['2028-02-28T23:00:00.000Z', '2028-02-29T03:00:00.000Z'],
    ['2028-02-29T23:00:00.000Z', '2028-03-01T03:00:00.000Z'],
  ])('resuelve cambios de mes, año y bisiesto: %s', (time, midnight) => {
    expect(nextArgentinaMidnight(Date.parse(time))).toBe(Date.parse(midnight))
  })

  it.each([Number.NaN, Infinity, -Infinity, Number.MAX_VALUE])('rechaza un reloj inválido: %s', timestamp => {
    expect(argentinaDay(timestamp)).toBeNull()
    expect(nextArgentinaMidnight(timestamp)).toBeNaN()
  })
})
