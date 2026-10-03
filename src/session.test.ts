import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPilotRuns, savePilotRun, clearPilotRuns, type PilotRun } from './session';

const KEY = 'saasguard:pilot-aggregates:v1';
const NOW = '2026-10-03T12:00:00.000Z';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

const run = (changes: Partial<PilotRun> = {}): PilotRun => ({
  organizationCode: 'PILOTO_01', completedAt: '2026-10-02T12:00:00.000Z',
  candidateCount: 6, selectedCount: 2, ...changes,
});

describe('local pilot aggregate privacy and validity', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reads only whitelisted aggregates and discards invalid records', () => {
    storage.setItem(KEY, JSON.stringify([
      { ...run(), emails: ['person@demo.example.invalid'], name: 'Persona ficticia', payroll: ['private'] },
      { ...run({ organizationCode: 'OTHER_02' }), selectedCount: 7 },
      null, [], 'not a record',
    ]));
    expect(readPilotRuns()).toEqual([run()]);
    expect(Object.keys(readPilotRuns()[0])).toEqual(['organizationCode', 'completedAt', 'candidateCount', 'selectedCount']);
  });

  it('persists no personnel fields from the new input or previously stored records', () => {
    storage.setItem(KEY, JSON.stringify([{ ...run(), email: 'old@demo.example.invalid', name: 'Persona anterior' }]));
    const incoming = { ...run({ organizationCode: 'NEW_02' }), email: 'new@demo.example.invalid', names: ['Persona nueva'], csv: 'private data' };
    savePilotRun(incoming);
    const persisted = JSON.parse(storage.getItem(KEY)!);
    expect(persisted).toEqual([run(), run({ organizationCode: 'NEW_02' })]);
    expect(storage.getItem(KEY)?.includes('@')).toBe(false);
    expect(persisted.every((entry: object) => Object.keys(entry).length === 4)).toBe(true);
  });

  it.each([
    'broken JSON', '{}', 'null', '123', '"not an array"',
  ])('handles corrupt or unknown localStorage content gracefully: %s', (text) => {
    storage.setItem(KEY, text);
    expect(readPilotRuns()).toEqual([]);
  });

  it('handles unavailable storage gracefully when reading', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(readPilotRuns()).toEqual([]);
  });

  it.each(['', 'a', 'lower_case', 'WITH SPACE', 'person@demo.example.invalid', 'A'.repeat(25)])(
    'rejects invalid organization codes before writing: %s', (organizationCode) => {
      storage.setItem(KEY, JSON.stringify([run()]));
      const original = storage.getItem(KEY);
      expect(() => savePilotRun(run({ organizationCode }))).toThrow(/código válido/);
      expect(storage.getItem(KEY)).toBe(original);
    },
  );

  it('accepts boundary codes and zero counts', () => {
    savePilotRun(run({ organizationCode: 'A1', candidateCount: 0, selectedCount: 0 }));
    savePilotRun(run({ organizationCode: 'A'.repeat(24), candidateCount: 3, selectedCount: 3, completedAt: NOW }));
    expect(readPilotRuns()).toHaveLength(2);
  });

  it.each([
    { candidateCount: -1 }, { selectedCount: -1 }, { selectedCount: 7 },
    { candidateCount: 1.5 }, { selectedCount: 0.5 },
    { candidateCount: Number.NaN }, { selectedCount: Number.POSITIVE_INFINITY },
    { candidateCount: Number.MAX_SAFE_INTEGER + 1 },
    { candidateCount: '6' }, { selectedCount: '2' },
  ])('rejects invalid count types or relationships: %j', (changes) => {
    expect(() => savePilotRun({ ...run(), ...changes } as PilotRun)).toThrow();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it.each([
    '2026-02-31T12:00:00.000Z', 'not a date', '2026-10-02',
    '2026-10-02T12:00:00', '2026-10-02T12:00:00.000+00:00',
    '2026-10-03T12:00:00.001Z',
  ])('rejects invalid, noncanonical or future timestamps: %s', (completedAt) => {
    expect(() => savePilotRun(run({ completedAt }))).toThrow();
    storage.setItem(KEY, JSON.stringify([run({ completedAt })]));
    expect(readPilotRuns()).toEqual([]);
  });

  it('validates the complete runtime shape, including null, arrays and nonstring dates', () => {
    for (const value of [null, [], {}, { ...run(), completedAt: 123 }, { ...run(), organizationCode: 123 }]) {
      expect(() => savePilotRun(value as PilotRun)).toThrow();
    }
  });

  it('keeps the most recent 100 valid entries while retaining repeat uses of an organization', () => {
    const entries = Array.from({ length: 110 }, (_, index) => run({
      organizationCode: `ORG_${index}`, completedAt: new Date(Date.parse(NOW) - (110 - index) * 1000).toISOString(),
    }));
    storage.setItem(KEY, JSON.stringify([...entries, null, { ...run(), organizationCode: 'bad' }]));
    expect(readPilotRuns()).toEqual(entries.slice(-100));
    savePilotRun(run({ organizationCode: 'ORG_109', completedAt: NOW }));
    const saved = readPilotRuns();
    expect(saved).toHaveLength(100);
    expect(saved[0].organizationCode).toBe('ORG_11');
    expect(saved.at(-1)).toEqual(run({ organizationCode: 'ORG_109', completedAt: NOW }));
    expect(saved.filter((entry) => entry.organizationCode === 'ORG_109')).toHaveLength(2);
  });

  it('surfaces write quota errors and leaves the existing aggregate unchanged', () => {
    storage.setItem(KEY, JSON.stringify([run()]));
    const previous = storage.getItem(KEY);
    const failure = new DOMException('quota exceeded', 'QuotaExceededError');
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw failure; });
    expect(() => savePilotRun(run({ organizationCode: 'NEW_02' }))).toThrow(failure);
    expect(storage.getItem(KEY)).toBe(previous);
  });

  it('clears only the pilot key and leaves unrelated localStorage data intact', () => {
    storage.setItem(KEY, JSON.stringify([run()]));
    storage.setItem('unrelated:setting', 'keep');
    clearPilotRuns();
    expect(readPilotRuns()).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
    expect(storage.getItem('unrelated:setting')).toBe('keep');
    expect(storage.length).toBe(1);
  });
});
