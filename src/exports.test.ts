import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Candidate } from './domain';
import {
  buildChecklistRows, buildChecklistWorkbook, buildChecklistPdfDocument,
  EXPORT_DISCLAIMER, PDF_FILENAME, XLSX_FILENAME,
} from './exports';
import { DEMO_EMPLOYEES_CSV, DEMO_LICENSES_CSV } from './demo';

const meta = { organization: 'Organización de prueba', createdAt: '2026-10-03T18:00:00Z', elapsedMs: 24 };
const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 'Google Workspace|ana@demo.example.invalid',
  email: 'ana@demo.example.invalid',
  originalEmail: ' ANA@DEMO.EXAMPLE.INVALID ',
  name: 'Ana Pérez',
  provider: 'Google Workspace',
  plan: 'Plan de prueba',
  cost: 20,
  review: 'confirmed',
  ...overrides,
});

function decode(workbook: XLSX.WorkBook): XLSX.WorkBook {
  const binary = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  expect(new Uint8Array(binary).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  return XLSX.read(binary, { type: 'array', cellFormula: true, cellNF: true });
}

/** Text may wrap across PDF text operators; join them to verify no value was truncated. */
function pdfText(pdf: string): string {
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
    .map((match) => match[1].replace(/\\([()\\])/g, '$1')).join('').replace(/\s/g, '');
}

describe('checklist export', () => {
  it('exports only explicitly confirmed accounts without changing human decisions', () => {
    const original = [candidate(), candidate({ id: 'pending', review: 'pending', cost: 999 }),
      candidate({ id: 'retained', review: 'retained', cost: 888 })];
    const snapshot = structuredClone(original);
    const rows = buildChecklistRows(original);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      originalEmail: ' ANA@DEMO.EXAMPLE.INVALID ', normalizedEmail: 'ana@demo.example.invalid',
      humanReview: 'Confirmada para checklist', status: 'Pendiente de revisión de baja', costUsd: 20,
    });
    expect(original).toEqual(snapshot);
  });

  it('writes a real XLSX with readable headers, exact selected totals and explicit unknown costs', () => {
    const accounts = [candidate(), candidate({ id: 'second', cost: 45 }),
      candidate({ id: 'unknown', cost: null }), candidate({ id: 'free', cost: 0 }),
      candidate({ id: 'not-selected', cost: 900, review: 'pending' })];
    const workbook = decode(buildChecklistWorkbook(accounts, meta));
    expect(workbook.SheetNames).toEqual(['Resumen', 'Checklist']);
    const overview = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets.Resumen, { header: 1 });
    expect(overview).toContainEqual(['Organización', meta.organization]);
    expect(overview).toContainEqual(['Cuentas seleccionadas', 4]);
    expect(overview).toContainEqual(['Ahorro potencial mensual (USD)', 65]);
    expect(overview).toContainEqual(['Cuentas con costo no informado', 1]);
    expect(overview).toContainEqual(['Aclaración', EXPORT_DISCLAIMER]);
    expect(overview).toContainEqual(['Tiempo de conciliación (ms)', 24]);
    const table = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets.Checklist, { header: 1 });
    expect(table[0]).toEqual(['Proveedor', 'Plan', 'Nombre', 'Email original', 'Email normalizado',
      'Costo mensual (USD)', 'Revisión humana', 'Estado', 'Responsable operativo', 'Nota']);
    expect(table).toHaveLength(5);
    expect(table[3][5]).toBe('No informado');
    expect(table[4][5]).toBe(0);
    expect(workbook.Sheets.Checklist.F2.t).toBe('n');
    expect(workbook.Sheets.Checklist.F4.t).toBe('s');
  });

  it('sums cents rather than binary floating point residues', () => {
    const workbook = decode(buildChecklistWorkbook([
      candidate({ cost: 0.1 }), candidate({ id: 'second', cost: 0.2 }),
    ], meta));
    expect(workbook.Sheets.Resumen.B5.v).toBe(0.3);
  });

  it('rejects invalid known costs instead of silently reporting them as unknown or zero', () => {
    for (const cost of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.001]) {
      expect(() => buildChecklistWorkbook([candidate({ cost })], meta)).toThrow();
    }
  });

  it('retains dangerous source strings as literal text cells after encoding and decoding XLSX', () => {
    const payloads = ['=1+1', '+SUM(A1:A2)', '-2+3', '@SUM(A1:A2)',
      ' \t\r\n=HYPERLINK("https://example.invalid","x")', '\u0000 \t+1'];
    const accounts = payloads.map((payload, index) => candidate({
      id: `literal-${index}`, name: payload, provider: payload, plan: payload,
      email: payload, originalEmail: payload, assignee: payload, note: payload,
    }));
    const organization = '\t \r\n=SUM(A1:A9)';
    const sourceWorkbook = buildChecklistWorkbook(accounts, { ...meta, organization });
    expect(sourceWorkbook.Sheets.Resumen.B2.v).toBe(organization);
    expect(sourceWorkbook.Sheets.Resumen.B2.t).toBe('s');
    const workbook = decode(sourceWorkbook);
    // SheetJS normalizes CRLF to LF when reading XLSX; the source cell stays literal and unchanged.
    const decodedText = (value: string) => value.replace(/\r\n/g, '\n');
    expect(workbook.Sheets.Resumen.B2.v).toBe(decodedText(organization));
    expect(workbook.Sheets.Resumen.B2.t).toBe('s');
    for (const sheet of [...Object.values(sourceWorkbook.Sheets), ...Object.values(workbook.Sheets)]) {
      for (const [address, cell] of Object.entries(sheet)) {
        if (address.startsWith('!')) continue;
        expect(cell.f).toBeUndefined();
        expect(cell.F).toBeUndefined();
      }
    }
    payloads.forEach((payload, index) => {
      for (const column of ['A', 'B', 'C', 'D', 'E', 'I', 'J']) {
        const sourceCell = sourceWorkbook.Sheets.Checklist[`${column}${index + 2}`];
        expect(sourceCell.t).toBe('s');
        expect(sourceCell.v).toBe(payload);
        expect(sourceCell.f).toBeUndefined();
        expect(sourceCell.F).toBeUndefined();
        const cell = workbook.Sheets.Checklist[`${column}${index + 2}`];
        expect(cell.t).toBe('s');
        expect(cell.v).toBe(decodedText(payload));
      }
    });
  });

  it('does not build a report that suggests results when nothing was selected', () => {
    const accounts = [candidate({ review: 'pending' }), candidate({ id: 'retained', review: 'retained' })];
    expect(buildChecklistRows(accounts)).toEqual([]);
    expect(() => buildChecklistWorkbook(accounts, meta)).toThrow(/Seleccioná/);
    expect(() => buildChecklistPdfDocument(accounts, meta)).toThrow(/Seleccioná/);
  });

  it('produces a PDF containing Spanish text, unknown cost and the selected potential only', () => {
    const doc = buildChecklistPdfDocument([
      candidate(), candidate({ id: 'second', cost: 45 }), candidate({ id: 'unknown', cost: null }),
      candidate({ id: 'pending', cost: 999, review: 'pending', name: 'NO_DEBE_APARECER' }),
    ], meta);
    const pdf = doc.output();
    const text = pdfText(pdf);
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(text.includes('Checklistderevisión')).toBe(true);
    expect(text.includes('AnaPérez')).toBe(true);
    expect(text.includes('USD65,00')).toBe(true);
    expect(text.includes('Noinformado')).toBe(true);
    expect(text.includes('NO_DEBE_APARECER')).toBe(false);
    expect(text.includes('Ahorropotencial.Revisiónybajamanualpendientes.')).toBe(true);
  });

  it('repeats headings and page numbers across a long PDF checklist', () => {
    const accounts = Array.from({ length: 140 }, (_, index) => candidate({
      id: `account-${index}`, email: `persona${index}@demo.example.invalid`,
      originalEmail: `persona${index}@demo.example.invalid`, name: `Persona ficticia ${index}`,
    }));
    const doc = buildChecklistPdfDocument(accounts, meta);
    const pdf = doc.output();
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    expect((pdf.match(/\(Proveedor\)/g) ?? []).length).toBe(pages);
    expect(pdfText(pdf).includes(`Página${pages}de${pages}`)).toBe(true);
    expect(pdfText(pdf).includes('persona139@demo.example.invalid')).toBe(true);
  });

  it('uses fixed downloadable filenames without organization or employee identifiers', () => {
    expect(XLSX_FILENAME).toBe('saasguard-checklist.xlsx');
    expect(PDF_FILENAME).toBe('saasguard-checklist.pdf');
  });
});

describe('fictitious demo controls', () => {
  it('contains twelve employees, eighteen licenses and six unmatched accounts across three providers', () => {
    const employees = Papa.parse<Record<string, string>>(DEMO_EMPLOYEES_CSV, { header: true, skipEmptyLines: true });
    const licenses = Papa.parse<Record<string, string>>(DEMO_LICENSES_CSV, { header: true, skipEmptyLines: true });
    expect(employees.errors).toEqual([]);
    expect(licenses.errors).toEqual([]);
    expect(employees.data).toHaveLength(12);
    expect(licenses.data).toHaveLength(18);
    const employeeEmails = new Set(employees.data.map((person) => person.email.trim().toLowerCase()));
    const unmatched = licenses.data.filter((license) => !employeeEmails.has(license.email.trim().toLowerCase()));
    expect(unmatched).toHaveLength(6);
    expect(new Set(unmatched.map((license) => license.provider))).toEqual(new Set(['Google Workspace', 'Slack', 'Jira']));
    expect(unmatched.filter((license) => license.cost === '')).toHaveLength(1);
    expect(unmatched.filter((license) => license.cost === '0')).toHaveLength(1);
    expect(unmatched.reduce((sum, license) => sum + Number(license.cost || 0), 0)).toBe(85);
    expect([...employees.data, ...licenses.data].every((person) => person.email.trim().toLowerCase().endsWith('@demo.example.invalid'))).toBe(true);
  });
});
