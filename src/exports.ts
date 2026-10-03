import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { costToCents, type Candidate } from './domain';

export interface ExportMeta {
  organization: string;
  createdAt: string;
  elapsedMs?: number;
}

export interface ChecklistRow {
  provider: string;
  plan: string;
  name: string;
  originalEmail: string;
  normalizedEmail: string;
  costUsd: number | 'No informado';
  humanReview: 'Confirmada para checklist';
  status: 'Pendiente de revisión de baja';
  assignee: string;
  note: string;
}

export const XLSX_FILENAME = 'saasguard-checklist.xlsx';
export const PDF_FILENAME = 'saasguard-checklist.pdf';
export const EXPORT_DISCLAIMER =
  'El ahorro es potencial mensual en USD, no ahorro realizado. Las cuentas requieren validación y baja manual en cada proveedor. La selección o exportación no ejecuta una baja.';

const HEADERS = [
  'Proveedor', 'Plan', 'Nombre', 'Email original', 'Email normalizado',
  'Costo mensual (USD)', 'Revisión humana', 'Estado', 'Responsable operativo', 'Nota',
];

/** Preserve source text. XLSX cells, rather than escaped CSV, enforce literal values. */
export function buildChecklistRows(candidates: readonly Candidate[]): ChecklistRow[] {
  return candidates.filter((candidate) => candidate.review === 'confirmed').map((candidate) => {
    const cents = costToCents(candidate.cost);
    return {
      provider: candidate.provider,
      plan: candidate.plan,
      name: candidate.name,
      originalEmail: candidate.originalEmail ?? candidate.email,
      normalizedEmail: candidate.email,
      costUsd: cents === null ? 'No informado' : cents / 100,
      humanReview: 'Confirmada para checklist',
      status: 'Pendiente de revisión de baja',
      assignee: candidate.assignee ?? '',
      note: candidate.note ?? '',
    };
  });
}

function checklistSummary(rows: readonly ChecklistRow[]) {
  const cents = rows.reduce((total, row) =>
    total + (typeof row.costUsd === 'number' ? (costToCents(row.costUsd) ?? 0) : 0), 0);
  return {
    selectedCount: rows.length,
    totalPotentialCents: cents,
    totalPotentialUsd: cents / 100,
    unknownCostCount: rows.filter((row) => row.costUsd === 'No informado').length,
  };
}

function requireSelection(rows: readonly ChecklistRow[]): void {
  if (!rows.length) throw new Error('Seleccioná al menos una cuenta confirmada para exportar el checklist.');
}

function rowsAsValues(rows: readonly ChecklistRow[]): (string | number)[][] {
  return rows.map((row) => [
    row.provider, row.plan, row.name, row.originalEmail, row.normalizedEmail,
    row.costUsd, row.humanReview, row.status, row.assignee, row.note,
  ]);
}

/** Every string is a text cell with no formula property, including leading controls and =,+,-,@. */
function literalSheet(values: (string | number)[][]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(values);
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!')) continue;
    const value = cell as XLSX.CellObject;
    delete value.f;
    delete value.F;
    if (typeof value.v === 'string') {
      value.t = 's';
      value.z = '@';
    }
  }
  return sheet;
}

export function buildChecklistWorkbook(candidates: readonly Candidate[], meta: ExportMeta): XLSX.WorkBook {
  const rows = buildChecklistRows(candidates);
  requireSelection(rows);
  const summary = checklistSummary(rows);
  const metadata: (string | number)[][] = [
    ['SaaSGuard Express - Checklist de revisión'],
    ['Organización', meta.organization],
    ['Fecha de auditoría', meta.createdAt],
    ['Cuentas seleccionadas', summary.selectedCount],
    ['Ahorro potencial mensual (USD)', summary.totalPotentialUsd],
    ['Cuentas con costo no informado', summary.unknownCostCount],
    ['Estado', 'Pendiente de revisión de baja'],
    ['Aclaración', EXPORT_DISCLAIMER],
  ];
  if (meta.elapsedMs !== undefined && Number.isFinite(meta.elapsedMs) && meta.elapsedMs >= 0) {
    metadata.push(['Tiempo de conciliación (ms)', Math.round(meta.elapsedMs)]);
  }
  const overview = literalSheet(metadata);
  overview['!cols'] = [{ wch: 36 }, { wch: 108 }];
  overview['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  overview.B5.z = '"USD "0.00';
  const checklist = literalSheet([HEADERS, ...rowsAsValues(rows)]);
  checklist['!cols'] = [22, 25, 28, 40, 40, 22, 28, 34, 26, 50].map((wch) => ({ wch }));
  for (let row = 1; row <= rows.length; row += 1) {
    const cell = checklist[XLSX.utils.encode_cell({ r: row, c: 5 })];
    if (cell.t === 'n') cell.z = '"USD "0.00';
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, overview, 'Resumen');
  XLSX.utils.book_append_sheet(workbook, checklist, 'Checklist');
  workbook.Props = {
    Title: 'SaaSGuard Express - Checklist de revisión',
    Subject: 'Ahorro potencial y revisión manual de cuentas',
    Author: 'SaaSGuard Express',
  };
  return workbook;
}

function money(value: number): string {
  return `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Helvetica supports the Spanish accents used by the report; tables wrap and repeat headings. */
export function buildChecklistPdfDocument(candidates: readonly Candidate[], meta: ExportMeta): jsPDF {
  const rows = buildChecklistRows(candidates);
  requireSelection(rows);
  const summary = checklistSummary(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  doc.setProperties({ title: 'SaaSGuard Express - Checklist de revisión', author: 'SaaSGuard Express' });
  const left = 12;
  const width = doc.internal.pageSize.getWidth() - left * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SaaSGuard Express - Checklist de revisión', left, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 24;
  const writeParagraph = (text: string) => {
    const lines: string[] = doc.splitTextToSize(text, width);
    doc.text(lines, left, y);
    y += lines.length * 4.1 + 2;
  };
  writeParagraph(`Organización: ${meta.organization || 'No informada'} | Fecha de auditoría: ${meta.createdAt}`);
  writeParagraph(`Cuentas seleccionadas: ${summary.selectedCount} | Ahorro potencial mensual: ${money(summary.totalPotentialUsd)} | Cuentas con costo no informado: ${summary.unknownCostCount}`);
  if (meta.elapsedMs !== undefined && Number.isFinite(meta.elapsedMs) && meta.elapsedMs >= 0) {
    writeParagraph(`Tiempo de conciliación registrado: ${Math.round(meta.elapsedMs)} ms.`);
  }
  writeParagraph(EXPORT_DISCLAIMER);
  autoTable(doc, {
    startY: y + 2,
    margin: { top: 19, left, right: left, bottom: 16 },
    head: [HEADERS],
    body: rowsAsValues(rows).map((values) => values.map((value, index) =>
      index === 5 && typeof value === 'number' ? money(value) : String(value))),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'striped',
    styles: {
      font: 'helvetica', fontSize: 7.5, cellPadding: 2,
      overflow: 'linebreak', valign: 'top', lineColor: [213, 225, 229], lineWidth: 0.1,
    },
    headStyles: { fillColor: [24, 41, 52], textColor: [255, 255, 255], fontSize: 8 },
    alternateRowStyles: { fillColor: [243, 248, 246] },
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 22 }, 2: { cellWidth: 24 },
      3: { cellWidth: 39 }, 4: { cellWidth: 39 }, 5: { cellWidth: 19, halign: 'right' },
      6: { cellWidth: 24 }, 7: { cellWidth: 31 }, 8: { cellWidth: 22 }, 9: { cellWidth: 'auto' },
    },
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('SaaSGuard Express - Checklist de revisión (continuación)', left, 11);
      }
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const footerY = doc.internal.pageSize.getHeight() - 7;
    doc.text('Ahorro potencial. Revisión y baja manual pendientes.', left, footerY);
    doc.text(`Página ${page} de ${pages}`, doc.internal.pageSize.getWidth() - left, footerY, { align: 'right' });
  }
  return doc;
}

export function exportChecklistXlsx(candidates: readonly Candidate[], meta: ExportMeta): void {
  XLSX.writeFile(buildChecklistWorkbook(candidates, meta), XLSX_FILENAME, {
    bookType: 'xlsx', compression: true,
  });
}

export function exportChecklistPdf(candidates: readonly Candidate[], meta: ExportMeta): void {
  buildChecklistPdfDocument(candidates, meta).save(PDF_FILENAME);
}
