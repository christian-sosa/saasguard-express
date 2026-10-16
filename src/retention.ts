/** Browser retention uses the calendar day in Argentina, regardless of the device's time zone. */
const argentinaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

export function argentinaDay(timestamp: number): string | null {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) return null
  const parts = argentinaDate.formatToParts(timestamp)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function nextArgentinaMidnight(timestamp: number): number {
  const day = argentinaDay(timestamp)
  if (!day) return Number.NaN
  // Argentina currently uses UTC−03 without daylight saving: 00:00 ART is 03:00 UTC.
  return Date.parse(`${day}T03:00:00.000Z`) + 24 * 60 * 60 * 1000
}
