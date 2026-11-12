import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, reconcile, summarize, validateEmployees, validateLicenseFiles } from './domain';

const read = (path: string) => parseCsv(readFileSync(new URL(`../fixtures/pruebas/05_casos_borde/${path}`, import.meta.url), 'utf8'));

function audit(folder: string) {
  const employees = validateEmployees(read(`${folder}/nomina.csv`), 'email');
  const licenses = validateLicenseFiles([{ name: 'licencias.csv', table: read(`${folder}/licencias.csv`), emailHeader: 'email' }], 'Google Workspace', null);
  const candidates = reconcile(licenses.licenses, employees.employees);
  return { employees, licenses, candidates, summary: summarize(candidates, licenses.licenses) };
}

describe('edge-case fixtures of the EN-02 matrix', () => {
  it('cero_candidatos: every account matches once emails are normalized', () => {
    const { employees, licenses, candidates, summary } = audit('cero_candidatos');
    expect(employees.valid && licenses.valid).toBe(true);
    expect(employees.employees).toHaveLength(3);
    expect(summary).toMatchObject({ totalLicenses: 3, matchedCount: 3, candidateCount: 0 });
    expect(candidates).toEqual([]);
  });

  it('homonimo_y_duplicados: same name stays a candidate, a duplicate counts once, unknown cost does not add', () => {
    const { employees, licenses, candidates, summary } = audit('homonimo_y_duplicados');
    expect(employees.valid && licenses.valid).toBe(true);
    expect(licenses.duplicateCount).toBe(1);
    expect(summary).toMatchObject({
      totalLicenses: 5, matchedCount: 1, candidateCount: 4, knownCostCount: 3, unknownCostCount: 1, potentialSavingsCents: 2300,
    });
    expect(candidates.map((c) => c.email)).toContain('aperez@example.test');
    expect(candidates.filter((c) => c.email === 'dario.sosa@example.test').map((c) => c.provider).sort()).toEqual(['Jira', 'Slack']);
  });
});
