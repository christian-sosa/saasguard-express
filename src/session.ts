import { argentinaDay } from './retention';

export type PilotRun = {
  organizationCode: string;
  completedAt: string;
  candidateCount: number;
  selectedCount: number;
};
const KEY = "saasguard:pilot-aggregates:v1";
const MAX_ENTRIES = 100;

/** Rebuild the aggregate explicitly so extra personnel fields cannot flow into persistence. */
function validAggregate(value: unknown, now: number): PilotRun | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.organizationCode !== "string" ||
    !/^[A-Z0-9_-]{2,24}$/.test(input.organizationCode) ||
    typeof input.completedAt !== "string" ||
    !Number.isSafeInteger(input.candidateCount) ||
    !Number.isSafeInteger(input.selectedCount)
  ) return null;
  const candidateCount = input.candidateCount as number;
  const selectedCount = input.selectedCount as number;
  if (candidateCount < 0 || selectedCount < 0 || selectedCount > candidateCount) return null;

  // The UI writes Date.toISOString(). Exact round trips reject impossible dates and loose Date.parse formats.
  const completedAt = input.completedAt;
  const timestamp = Date.parse(completedAt);
  if (
    !Number.isFinite(timestamp) || !Number.isFinite(now) || timestamp > now ||
    new Date(timestamp).toISOString() !== completedAt || argentinaDay(timestamp) !== argentinaDay(now)
  ) return null;
  return { organizationCode: input.organizationCode, completedAt, candidateCount, selectedCount };
}

export function readPilotRuns(): PilotRun[] {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === null) return [];
    let value: unknown;
    try { value = JSON.parse(stored); } catch { value = []; }
    const now = Date.now();
    const runs = (Array.isArray(value) ? value : []).map((entry) => validAggregate(entry, now))
      .filter((entry): entry is PilotRun => entry !== null)
      .slice(-MAX_ENTRIES);
    // Remove yesterday's records from storage itself, including on the first visit after a closed browser.
    try {
      if (!runs.length) localStorage.removeItem(KEY);
      else if (stored !== JSON.stringify(runs)) localStorage.setItem(KEY, JSON.stringify(runs));
    } catch { /* Storage may be blocked. Expired records are still excluded from the app. */ }
    return runs;
  } catch {
    return [];
  }
}
export function savePilotRun(run: PilotRun): void {
  const aggregate = validAggregate(run, Date.now());
  if (!aggregate) {
    throw new Error("El registro necesita un código válido, fecha ISO UTC de hoy en Argentina no futura y conteos enteros con seleccionadas dentro del total de candidatas.");
  }
  // Existing entries are read through the same whitelist. A failed write is surfaced to the caller.
  localStorage.setItem(
    KEY,
    JSON.stringify([...readPilotRuns(), aggregate].slice(-MAX_ENTRIES)),
  );
}
export function clearPilotRuns(): void {
  localStorage.removeItem(KEY);
}
