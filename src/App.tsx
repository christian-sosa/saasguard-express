import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconUsers,
  IconCloud,
  IconFileTypeCsv,
  IconBolt,
  IconDownload,
  IconShieldCheck,
  IconArrowRight,
  IconX,
  IconSearch,
  IconCheck,
  IconAlertTriangle,
  IconRefresh,
  IconClipboardCheck,
  IconTrash,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconChevronLeft,
  IconAdjustments,
  IconClock,
  IconChartBar,
  IconArrowsDiff,
  IconPlus,
} from "@tabler/icons-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  parseCsv,
  validateEmployees,
  validateLicenseFiles,
  reconcile,
  summarize,
  parseMonthlyCost,
  pickEmailHeader,
  createSnapshot,
  compareSnapshots,
  isExpired,
  type Candidate,
  type CsvTable,
  type Issue,
  type License,
  type Employee,
} from "./domain";
import { exportChecklistXlsx, exportChecklistPdf } from "./exports";
import { DEMO_EMPLOYEES_CSV, DEMO_LICENSES_CSV } from "./demo";
import { readPilotRuns, savePilotRun, clearPilotRuns } from "./session";
import { auditStamp, providerSummary, reviewText } from "./labels";

type Upload = { name: string; table: CsvTable; emailHeader: string };
type Page = "load" | "results" | "checklist" | "closed";
const colors = [
  "#ada0f4",
  "#96dbc4",
  "#8bb8ed",
  "#f4c47f",
  "#e89ab6",
  "#aab4c8",
];
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
const reviewLabels = {
  pending: "Por revisar",
  confirmed: "Al checklist",
  retained: "Mantener cuenta",
};
const countLabel = (count: number, singular: string, plural: string) =>
  count === 1 ? singular : plural;
const counted = (count: number, singular: string, plural: string) =>
  `${count} ${countLabel(count, singular, plural)}`;
function parseUpload(name: string, text: string): Upload {
  const parsed = parseCsv(text);
  return { name, table: parsed, emailHeader: pickEmailHeader(parsed.headers) };
}
async function readCsv(file: File): Promise<Upload> {
  if (!/\.csv$/i.test(file.name))
    throw new Error(
      "Elegí un archivo CSV. Las planillas XLSX deben exportarse a CSV primero.",
    );
  if (file.size > 5 * 1024 * 1024)
    throw new Error("El archivo supera el límite de 5 MB.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(
      "El CSV debe estar guardado en UTF-8. Volvé a exportarlo con esa codificación.",
    );
  }
  return parseUpload(file.name, text);
}
function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant}`} {...props}>
      {children}
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] button:not(:disabled), [role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] a[href]',
          ),
        ).filter((x) => x.offsetParent !== null);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal ${wide ? "wide" : ""}`}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button
            ref={closeRef}
            className="icon-button"
            aria-label="Cerrar ventana"
            onClick={onClose}
          >
            <IconX size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <details
      className="issues"
      open={issues.some((i) => i.severity === "error")}
    >
      <summary>
        <IconAlertTriangle size={16} />{" "}
        {issues.filter((i) => i.severity === "error").length} errores ·{" "}
        {issues.filter((i) => i.severity === "warning").length} avisos
      </summary>
      <ul>
        {issues.slice(0, 30).map((i, index) => (
          <li key={index} className={i.severity}>
            Fila {i.row}: {i.message}
          </li>
        ))}
      </ul>
      {issues.length > 30 && (
        <p>
          Se muestran las primeras 30 observaciones. Corregí el archivo y volvé
          a cargarlo.
        </p>
      )}
    </details>
  );
}

function CsvPreview({ upload }: { upload: Upload }) {
  return (
    <details className="csv-preview">
      <summary>Ver primeras 3 filas</summary>
      <div className="csv-preview-scroll">
        <table>
          <caption>{upload.name}</caption>
          <thead>
            <tr>
              {upload.table.headers.map((header, index) => (
                <th key={`${header}-${index}`} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upload.table.rows.slice(0, 3).map((row, index) => (
              <tr key={index}>
                {upload.table.headers.map((header, column) => (
                  <td key={`${header}-${column}`}>{row[header] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {upload.table.rows.length === 0 && (
        <p>El archivo no tiene filas de datos.</p>
      )}
    </details>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("load");
  const [hr, setHr] = useState<Upload | null>(null);
  const [currentRoster, setCurrentRoster] = useState(false);
  const [saas, setSaas] = useState<Upload[]>([]);
  const [provider, setProvider] = useState("Google Workspace");
  const [defaultCost, setDefaultCost] = useState("");
  const [organization, setOrganization] = useState("");
  const [licenses, setLicenses] = useState<License[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [active, setActive] = useState<Candidate | null>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [editCost, setEditCost] = useState("");
  const [modal, setModal] = useState<"close" | "compare" | "pilot" | null>(
    null,
  );
  const [snapshots, setSnapshots] = useState<[unknown | null, unknown | null]>([
    null,
    null,
  ]);
  const [comparison, setComparison] = useState<ReturnType<
    typeof compareSnapshots
  > | null>(null);
  const [snapshotProvider, setSnapshotProvider] = useState("");
  const [pilotCode, setPilotCode] = useState("");
  const [pilotRuns, setPilotRuns] = useState(readPilotRuns);
  const [closedCount, setClosedCount] = useState(0);
  const [pilotSaved, setPilotSaved] = useState(false);
  const hrInput = useRef<HTMLInputElement>(null),
    saasInput = useRef<HTMLInputElement>(null);
  const sessionEpoch = useRef(0);
  const snapshotEpoch = useRef(0);
  const snapshotReadEpoch = useRef<[number, number]>([0, 0]);
  const uploadEpoch = useRef({ hr: 0, saas: 0 });
  const liveCandidates = useRef(candidates);
  liveCandidates.current = candidates;

  function clearAudit(message = "") {
    sessionEpoch.current++;
    snapshotEpoch.current++;
    setClosedCount(
      liveCandidates.current.filter((c) => c.review === "confirmed").length,
    );
    setHr(null);
    setCurrentRoster(false);
    setSaas([]);
    setLicenses([]);
    setEmployees([]);
    setCandidates([]);
    setActive(null);
    setSnapshots([null, null]);
    setComparison(null);
    setSearch("");
    setOrganization("");
    setDefaultCost("");
    setProviderFilter("all");
    setReviewFilter("all");
    setSnapshotProvider("");
    setNote("");
    setAssignee("");
    setEditCost("");
    setError("");
    setBusy(false);
    setModal(null);
    setPage("closed");
    setNotice(message);
    setIsDemo(false);
    if (hrInput.current) hrInput.current.value = "";
    if (saasInput.current) saasInput.current.value = "";
  }
  useEffect(() => {
    const check = () => {
      if (isExpired(createdAt) && page !== "closed")
        clearAudit(
          "La sesión alcanzó las 24 horas. Los datos de trabajo se eliminaron.",
        );
    };
    const timer = setTimeout(
      check,
      Math.max(0, Date.parse(createdAt) + 86400000 - Date.now()),
    );
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [createdAt, page]);
  function requireSession() {
    if (isExpired(createdAt)) {
      clearAudit("La sesión venció y los datos se eliminaron.");
      return false;
    }
    return true;
  }
  function closeComparison() {
    snapshotEpoch.current++;
    setModal(null);
    setSnapshots([null, null]);
    setComparison(null);
    setError("");
  }

  const hrResult = useMemo(
    () => (hr ? validateEmployees(hr.table, hr.emailHeader) : null),
    [hr],
  );
  const parsedDefaultCost = useMemo(() => {
    try {
      return parseMonthlyCost(defaultCost);
    } catch {
      return undefined;
    }
  }, [defaultCost]);
  const saasResult = useMemo(() => {
    if (!saas.length) return null;
    return validateLicenseFiles(saas, provider, parsedDefaultCost);
  }, [saas, provider, parsedDefaultCost]);
  const costValid = parsedDefaultCost !== undefined;
  const ready = Boolean(
    currentRoster &&
    hrResult?.valid &&
    hrResult.employees.length &&
    saasResult?.valid &&
    saasResult.licenses.length &&
    costValid,
  );
  const stats = useMemo(
    () => summarize(candidates, licenses),
    [candidates, licenses],
  );
  const selected = candidates.filter((c) => c.review === "confirmed");
  const pendingCount = candidates.filter((c) => c.review === "pending").length;
  const providers = [...new Set(licenses.map((l) => l.provider))].sort();
  const matched = useMemo(() => {
    const flagged = new Set(candidates.map((c) => c.id));
    return licenses.filter((l) => !flagged.has(l.id));
  }, [candidates, licenses]);
  const filtered = candidates.filter(
    (c) =>
      (providerFilter === "all" || c.provider === providerFilter) &&
      (reviewFilter === "all" || c.review === reviewFilter) &&
      `${c.name} ${c.email} ${c.provider} ${c.plan}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const distribution = providers
    .map((name, index) => ({
      name,
      value:
        Math.round(
          candidates
            .filter((c) => c.provider === name)
            .reduce((sum, c) => sum + (c.cost ?? 0), 0) * 100,
        ) / 100,
      color: colors[index % colors.length],
    }))
    .filter((c) => c.value > 0);
  const totalPotential = distribution.reduce((sum, c) => sum + c.value, 0);

  async function upload(
    fileList: FileList | File[],
    kind: "hr" | "saas",
    append = false,
  ) {
    const epoch = sessionEpoch.current;
    const operation = ++uploadEpoch.current[kind];
    setError("");
    setBusy(true);
    try {
      const uploads = await Promise.all(Array.from(fileList).map(readCsv));
      if (
        epoch !== sessionEpoch.current ||
        operation !== uploadEpoch.current[kind]
      )
        return;
      if (!requireSession()) return;
      if (kind === "hr") {
        setHr(uploads[0] ?? null);
        setCurrentRoster(false);
      } else
        setSaas((previous) => (append ? [...previous, ...uploads] : uploads));
      setIsDemo(false);
      setPilotSaved(false);
      setNotice("");
    } catch (e) {
      if (epoch === sessionEpoch.current)
        setError(
          e instanceof Error ? e.message : "No pudimos leer el archivo.",
        );
    } finally {
      if (epoch === sessionEpoch.current) setBusy(false);
    }
  }
  function demo() {
    sessionEpoch.current++;
    snapshotEpoch.current++;
    setBusy(false);
    setHr(parseUpload("nomina_demo.csv", DEMO_EMPLOYEES_CSV));
    setSaas([parseUpload("licencias_demo.csv", DEMO_LICENSES_CSV)]);
    setOrganization("Empresa de ejemplo");
    setDefaultCost("");
    setCreatedAt(new Date().toISOString());
    setCurrentRoster(true);
    setIsDemo(true);
    setPilotSaved(false);
    setError("");
    setNotice("Datos ficticios cargados. Podés reemplazarlos por tus CSV.");
  }
  async function audit() {
    if (!ready || !hrResult || !saasResult) return;
    if (isExpired(createdAt)) {
      clearAudit("La sesión venció. Cargá los archivos de nuevo.");
      return;
    }
    setBusy(true);
    setError("");
    const start = performance.now();
    try {
      const next = reconcile(saasResult.licenses, hrResult.employees);
      setLicenses(saasResult.licenses);
      setEmployees(hrResult.employees);
      setCandidates(next);
      setElapsedMs(Math.max(1, Math.ceil(performance.now() - start)));
      setSnapshotProvider(
        [...new Set(saasResult.licenses.map((l) => l.provider))][0] ?? "",
      );
      setPage("results");
      setNotice("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar el cruce.",
      );
    } finally {
      setBusy(false);
    }
  }
  function review(candidate: Candidate) {
    if (!requireSession()) return;
    setActive(candidate);
    setNote(candidate.note ?? "");
    setAssignee(candidate.assignee ?? "");
    setEditCost(candidate.cost === null ? "" : String(candidate.cost));
    setError("");
  }
  function saveReview(value: Candidate["review"]) {
    if (!requireSession()) return;
    if (!active) return;
    if (value === "confirmed" && !assignee.trim()) {
      setError(
        "Indicá quién revisó el caso antes de incluirlo en el checklist.",
      );
      return;
    }
    try {
      const cost = parseMonthlyCost(editCost);
      const next = candidates.map((c) =>
        c.id === active.id
          ? {
              ...c,
              review: value,
              note: note.trim(),
              assignee: assignee.trim(),
              cost,
            }
          : c,
      );
      summarize(next, licenses);
      setCandidates(next);
      setActive(null);
      setError("");
      setNotice(
        value === "confirmed"
          ? "Caso revisado e incluido en el checklist. La baja debe ejecutarse manualmente."
          : value === "pending"
            ? "La nota quedó guardada y el caso sigue por revisar con RRHH."
            : "Cuenta marcada para mantener.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar la revisión del caso.",
      );
    }
  }
  function exportReport(type: "xlsx" | "pdf") {
    if (!requireSession()) return;
    try {
      const meta = {
        organization: organization || "Organización sin identificar",
        createdAt,
        elapsedMs,
      };
      if (type === "xlsx") exportChecklistXlsx(candidates, meta);
      else exportChecklistPdf(candidates, meta);
      setNotice(
        `Checklist ${type.toUpperCase()} descargado con ${counted(selected.length, "cuenta revisada", "cuentas revisadas")}.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos generar la exportación.",
      );
    }
  }
  function exportSnapshot() {
    if (!requireSession()) return;
    try {
      const subset = candidates.filter((c) => c.provider === snapshotProvider);
      downloadJson(
        createSnapshot(
          subset,
          snapshotProvider,
          licenses.filter((l) => l.provider === snapshotProvider).length,
          createdAt,
        ),
        "saasguard-snapshot-completo.json",
      );
      setNotice(
        "Snapshot completo descargado. Incluye datos personales: guardalo en un lugar adecuado.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo generar el snapshot.",
      );
    }
  }
  async function readSnapshot(file: File, index: 0 | 1) {
    if (!requireSession()) return;
    const epoch = sessionEpoch.current,
      operation = snapshotEpoch.current,
      readOperation = ++snapshotReadEpoch.current[index];
    setSnapshots((previous) =>
      index === 0 ? [null, previous[1]] : [previous[0], null],
    );
    setComparison(null);
    setError("");
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("El snapshot supera 5 MB.");
      const data: unknown = JSON.parse(await file.text());
      if (
        epoch !== sessionEpoch.current ||
        operation !== snapshotEpoch.current ||
        readOperation !== snapshotReadEpoch.current[index] ||
        !requireSession()
      )
        return;
      setSnapshots((previous) =>
        index === 0 ? [data, previous[1]] : [previous[0], data],
      );
      setComparison(null);
      setError("");
    } catch (e) {
      if (
        epoch === sessionEpoch.current &&
        operation === snapshotEpoch.current &&
        readOperation === snapshotReadEpoch.current[index]
      )
        setError(
          e instanceof SyntaxError
            ? "El archivo no es un JSON válido. Volvé a exportar el snapshot e intentá nuevamente."
            : e instanceof Error
              ? e.message
              : "No es un snapshot JSON válido.",
        );
    }
  }
  function runComparison() {
    if (!requireSession()) return;
    try {
      setComparison(compareSnapshots(snapshots[0], snapshots[1]));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos comparar los snapshots.",
      );
    }
  }
  function registerPilot() {
    if (!requireSession()) return;
    try {
      const code = pilotCode.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,24}$/.test(code))
        throw new Error(
          "Usá un código de 2 a 24 letras, números, guiones o guiones bajos.",
        );
      if (isDemo)
        throw new Error(
          "Los datos de demostración no cuentan como un piloto real.",
        );
      savePilotRun({
        organizationCode: code,
        completedAt: new Date().toISOString(),
        candidateCount: candidates.length,
        selectedCount: selected.length,
      });
      setPilotRuns(readPilotRuns());
      setPilotSaved(true);
      setNotice(
        "Se guardaron únicamente el código, la fecha y los conteos del piloto en este navegador.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar el piloto.",
      );
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-mark"
            src="/saasguard-mark.png"
            alt="SaaSGuard"
          />
          <span>
            SaaSGuard Express
            {page === "results"
              ? " — Resultado de la auditoría"
              : page === "checklist"
                ? " — Checklist de bajas"
                : ""}
          </span>
        </div>
        <span className={`step-pill ${page === "results" ? "rose" : ""}`}>
          {page === "load"
            ? "Paso 1 de 4 · Carga"
            : page === "results"
              ? "Paso 2 de 4 · Revisión"
              : page === "checklist"
                ? "Paso 3 de 4 · Checklist"
                : "Paso 4 de 4 · Cierre"}
        </span>
        <div className="header-right">
          <span className="time-hint">
            {page === "load" ? (
              <>
                Objetivo: <strong>&lt; 60 segundos</strong>
              </>
            ) : page !== "closed" ? (
              <>
                Cruce:{" "}
                <strong>
                  {elapsedMs < 1000
                    ? `${Math.max(1, Math.round(elapsedMs))} ms`
                    : `${(elapsedMs / 1000).toFixed(2)} s`}
                </strong>
              </>
            ) : (
              <>
                <IconShieldCheck size={18} /> Datos eliminados
              </>
            )}
          </span>
          <div className="local-mode">
            <span className="avatar">IT</span>
            <div>
              <strong>Auditoría local</strong>
              <small>
                {isDemo
                  ? "Datos ficticios · Demostración"
                  : "Sin cuenta · Datos en este navegador"}
              </small>
            </div>
          </div>
          {page !== "closed" && (
            <Button variant="ghost" onClick={() => setModal("close")}>
              Cerrar auditoría
            </Button>
          )}
        </div>
      </header>
      <div aria-live="polite" className="messages">
        {notice && (
          <div className="notice">
            <IconCheck size={18} />
            {notice}
            <button aria-label="Descartar aviso" onClick={() => setNotice("")}>
              <IconX size={16} />
            </button>
          </div>
        )}
        {error && !active && (
          <div role="alert" className="error-banner">
            <IconAlertTriangle size={18} />
            {error}
          </div>
        )}
      </div>

      {page === "load" && (
        <div className="load-content">
          <div className="page-heading">
            <h1>Conciliación Express de Licencias y Nómina Salarial</h1>
            <p>
              Subí la nómina vigente de RRHH y la exportación de usuarios SaaS.
              El cruce se habilita cuando ambos archivos están validados.
            </p>
          </div>
          <details className="prep-guide">
            <summary>Cómo preparar los archivos</summary>
            <div className="prep-guide-body">
              <p>
                <strong>Nómina de RRHH.</strong> Sólo personal vigente. La
                columna obligatoria es <code>email</code>; <code>nombre</code> y{" "}
                <code>area</code> ayudan a revisar cada caso. No hace falta el
                motivo de egreso ni otros datos del personal.
              </p>
              <p>
                <strong>Usuarios o licencias de la plataforma.</strong> Es la
                exportación de cada plataforma, distinta de la nómina. La
                columna obligatoria es <code>email</code>;{" "}
                <code>proveedor</code>, <code>plan</code> y{" "}
                <code>costo_mensual</code> (USD por cuenta) son opcionales. Si
                falta el proveedor se usa el proveedor por defecto.
              </p>
              <p>
                <strong>Exportación manual.</strong> Exportás los datos a mano
                desde cada plataforma y los subís acá. SaaSGuard no se conecta a
                Google Workspace, Slack ni Jira y no pide credenciales ni
                permisos.
              </p>
              <p>
                <strong>Por dónde empezar.</strong> La primera biblioteca de
                ejemplos usa Google Workspace, Slack y Jira. Descargá las
                plantillas de cada tarjeta para ver el formato esperado.
              </p>
            </div>
          </details>
          <div className="audit-context">
            <label>
              Organización{" "}
              <input
                value={organization}
                maxLength={80}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Nombre para el reporte (opcional)"
              />
            </label>
            <Button variant="ghost" onClick={demo}>
              <IconBolt size={17} /> Probar con datos de ejemplo
            </Button>
          </div>
          <div className="upload-grid">
            <section className="upload-card hr-card">
              <div className="upload-title">
                <span className="round-icon">
                  <IconUsers size={28} />
                </span>
                <div>
                  <h2>1. Padrón Oficial de Recursos Humanos</h2>
                  <p>
                    Nómina actualizada de colaboradores activos de la empresa
                  </p>
                </div>
              </div>
              <button
                className={`dropzone ${hrResult?.valid ? "valid" : ""}`}
                onClick={() => hrInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void upload(e.dataTransfer.files, "hr");
                }}
                disabled={busy}
              >
                <IconFileTypeCsv size={40} />
                <strong>
                  {hr?.name ?? "Seleccioná o arrastrá el CSV de RRHH"}
                </strong>
                <span>
                  {hrResult
                    ? `${counted(hrResult.employees.length, "colaborador", "colaboradores")} · ${hrResult.valid ? "Archivo validado" : "Revisá las observaciones"}`
                    : "email, nombre y área · Máximo 250 filas"}
                </span>
              </button>
              <input
                ref={hrInput}
                className="file-input"
                aria-label="Cargar nómina CSV"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  if (e.target.files?.length) void upload(e.target.files, "hr");
                }}
              />
              {hr && (
                <div className="mapping">
                  <label>
                    Columna de email
                    <select
                      value={hr.emailHeader}
                      onChange={(e) =>
                        setHr({ ...hr, emailHeader: e.target.value })
                      }
                    >
                      {hr.table.headers.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                  <CsvPreview upload={hr} />
                  <Issues issues={hrResult?.issues ?? []} />
                  <label className="roster-confirm">
                    <input
                      type="checkbox"
                      checked={currentRoster}
                      onChange={(e) => setCurrentRoster(e.target.checked)}
                    />{" "}
                    Confirmo que esta nómina contiene personal vigente
                  </label>
                </div>
              )}
              <a className="template-link" href="/ejemplos/nomina.csv" download>
                <IconDownload size={15} /> Descargar plantilla de nómina
              </a>
            </section>
            <section className="upload-card saas-card">
              <div className="upload-title">
                <span className="round-icon">
                  <IconCloud size={28} />
                </span>
                <div>
                  <h2>2. Exportación de Usuarios de Plataformas SaaS</h2>
                  <p>
                    Una o más exportaciones de Google Workspace, Slack o Jira
                  </p>
                </div>
              </div>
              <button
                className={`dropzone ${saasResult?.valid ? "valid" : ""}`}
                onClick={() => saasInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void upload(e.dataTransfer.files, "saas");
                }}
                disabled={busy}
              >
                <IconChartBar size={40} />
                <strong>
                  {saas.length
                    ? saas.map((s) => s.name).join(" · ")
                    : "Seleccioná o arrastrá tus archivos CSV"}
                </strong>
                <span>
                  {saasResult
                    ? `${counted(saasResult.licenses.length, "licencia", "licencias")}${saasResult.licenses.length ? ` · ${providerSummary(saasResult.licenses)}` : ""} · ${saasResult.valid ? countLabel(saas.length, "Archivo validado", "Archivos validados") : "Revisá las observaciones"}`
                    : "email, proveedor, plan y costo_mensual · Máximo 1.000 filas"}
                </span>
              </button>
              <input
                ref={saasInput}
                className="file-input"
                aria-label="Cargar licencias CSV"
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length)
                    void upload(e.target.files, "saas");
                }}
              />
              {saas.length > 0 && (
                <div className="mapping">
                  {saas.map((s, index) => (
                    <div className="mapping-source" key={`${s.name}-${index}`}>
                      <div className="mapping-row">
                        <label>
                          {s.name}
                          <select
                            aria-label={`Email de ${s.name}`}
                            value={s.emailHeader}
                            onChange={(e) =>
                              setSaas((previous) =>
                                previous.map((p, i) =>
                                  i === index
                                    ? { ...p, emailHeader: e.target.value }
                                    : p,
                                ),
                              )
                            }
                          >
                            {s.table.headers.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="icon-button"
                          aria-label={`Quitar ${s.name}`}
                          onClick={() =>
                            setSaas((previous) =>
                              previous.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <IconX size={18} />
                        </button>
                      </div>
                      <CsvPreview upload={s} />
                    </div>
                  ))}
                  <Issues issues={saasResult?.issues ?? []} />
                </div>
              )}
              <a
                className="template-link"
                href="/ejemplos/licencias.csv"
                download
              >
                <IconDownload size={15} /> Descargar plantilla de licencias
              </a>
            </section>
          </div>
          <div className="defaults-heading">
            PROVEEDOR Y COSTO PARA LAS FILAS QUE NO LOS INFORMEN
          </div>
          <div className="defaults-grid">
            <label className="default-card">
              Proveedor por defecto
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option>Google Workspace</option>
                <option>Slack</option>
                <option>Jira</option>
                <option>Trello</option>
                <option>Figma</option>
                <option>Zoom</option>
                <option>Notion</option>
              </select>
            </label>
            <label className="default-card">
              Costo mensual por licencia
              <input
                aria-label="Costo mensual por defecto"
                inputMode="decimal"
                value={defaultCost}
                onChange={(e) => setDefaultCost(e.target.value)}
                placeholder="Sin informar"
              />
              <small>USD/mes · vacío = desconocido</small>
            </label>
            <div className="default-note">
              <IconAlertTriangle size={20} />
              <p>
                Usá el costo de tu contrato. No completamos precios comerciales
                ni inferimos actividad o bajas.
              </p>
            </div>
          </div>
          {!costValid && (
            <p role="alert" className="field-error">
              El costo debe ser un número positivo o cero, con hasta dos
              decimales.
            </p>
          )}
          <Button
            onClick={() => void audit()}
            disabled={!ready || busy}
            className="button primary audit-button"
          >
            <IconBolt size={22} />
            {busy ? "Validando archivos…" : "Auditar y Cruzar Datos"}
          </Button>
          <div className="privacy-strip">
            <IconShieldCheck size={19} /> Sin contraseñas ni conexión a tus
            plataformas: los CSV se procesan en este navegador y se borran al
            cerrar la auditoría o a las 24 horas.
          </div>
        </div>
      )}

      {page === "results" && (
        <div className="results-content">
          <div className="stats-grid">
            <Stat
              label="AHORRO POTENCIAL MENSUAL"
              value={money(stats.potentialSavings)}
              caption="Suma de costos conocidos · No es ahorro realizado"
              tone="rose"
              icon={<IconChartBar />}
            />
            <Stat
              label="CUENTAS CANDIDATAS"
              value={String(candidates.length)}
              suffix={countLabel(candidates.length, "cuenta", "cuentas")}
              caption={countLabel(
                candidates.length,
                "No figura en la nómina cargada",
                "No figuran en la nómina cargada",
              )}
              tone="rose"
              icon={<IconUsers />}
            />
            <Stat
              label="COSTO SIN INFORMAR"
              value={String(stats.unknownCostCount)}
              suffix={countLabel(
                stats.unknownCostCount,
                "licencia",
                "licencias",
              )}
              caption={countLabel(
                stats.unknownCostCount,
                "Se excluye del cálculo de ahorro",
                "Se excluyen del cálculo de ahorro",
              )}
              tone="amber"
              icon={<IconAlertTriangle />}
            />
            <Stat
              label="CASOS POR REVISAR"
              value={String(pendingCount)}
              suffix={countLabel(pendingCount, "caso", "casos")}
              caption={countLabel(
                pendingCount,
                "Confirmalo antes del checklist",
                "Confirmalos antes del checklist",
              )}
              tone="violet"
              icon={<IconClipboardCheck />}
            />
          </div>
          <div className="result-layout">
            <section className="cases">
              <h2>Casos detectados</h2>
              <p className="muted">
                La ausencia en RRHH requiere revisión humana. Abrí cada ficha
                para decidir cómo seguir.
              </p>
              <p className="muted audit-stamp">
                {auditStamp(createdAt)} · Proveedores:{" "}
                {providerSummary(licenses) || "sin informar"}
              </p>
              <div className="filters">
                <label className="search">
                  <IconSearch size={17} />
                  <input
                    aria-label="Buscar casos"
                    placeholder="Buscar por colaborador, email o plan"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrar plataforma"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                >
                  <option value="all">Todas las plataformas</option>
                  {providers.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar revisión"
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Por revisar</option>
                  <option value="confirmed">Al checklist</option>
                  <option value="retained">Mantener cuenta</option>
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>COLABORADOR</th>
                      <th>ESTADO RRHH</th>
                      <th>PLATAFORMA SAAS</th>
                      <th>ROL / LICENCIA</th>
                      <th>COSTO / MES</th>
                      <th>REVISIÓN</th>
                      <th>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className={c.review}>
                        <td>
                          <div className="person">
                            <span className="initials">
                              {c.name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase() || "?"}
                            </span>
                            <div>
                              <strong>{c.name || c.email}</strong>
                              <small>{c.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge rose">
                            No figura en nómina
                          </span>
                        </td>
                        <td>{c.provider}</td>
                        <td>{c.plan || "Sin informar"}</td>
                        <td className="cost">
                          {c.cost === null ? (
                            <span className="muted">Sin informar</span>
                          ) : (
                            money(c.cost)
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${c.review === "confirmed" ? "mint" : c.review === "retained" ? "neutral" : "amber"}`}
                          >
                            {reviewText(c)}
                          </span>
                          {c.note?.trim() && (
                            <small className="review-note" title={c.note}>
                              Nota: {c.note.trim().slice(0, 60)}
                              {c.note.trim().length > 60 ? "…" : ""}
                            </small>
                          )}
                        </td>
                        <td>
                          <button
                            className="row-button"
                            onClick={() => review(c)}
                          >
                            Ver ficha <IconArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="empty-state">
                    <IconShieldCheck size={36} />
                    <h3>
                      {candidates.length
                        ? "No hay casos con estos filtros"
                        : "No encontramos cuentas fuera de la nómina"}
                    </h3>
                    <p>
                      {candidates.length
                        ? "Probá con otro nombre, plataforma o estado."
                        : "Los emails de las licencias coinciden con los de la nómina vigente."}
                    </p>
                  </div>
                )}
              </div>
              <small className="table-caption">
                {filtered.length} de{" "}
                {counted(candidates.length, "candidata", "candidatas")} ·{" "}
                {counted(employees.length, "colaborador", "colaboradores")} ·{" "}
                {counted(licenses.length, "licencia única", "licencias únicas")} ·{" "}
                {stats.matchedCount}{" "}
                {countLabel(
                  stats.matchedCount,
                  "coincide con la nómina",
                  "coinciden con la nómina",
                )}
              </small>
              {matched.length > 0 && (
                <details className="matched-list">
                  <summary>
                    Coinciden con la nómina ({matched.length})
                  </summary>
                  <ul>
                    {matched.map((l) => (
                      <li key={l.id}>
                        <span className="badge mint">Coincide con nómina</span>{" "}
                        {l.name || l.email} · {l.email} · {l.provider}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
            <aside className="chart-panel">
              <h3>Potencial por plataforma</h3>
              <p className="muted">Sólo costos mensuales conocidos</p>
              <div className="donut">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={
                        distribution.length
                          ? distribution
                          : [{ name: "Sin costos", value: 1, color: "#e8eaf0" }]
                      }
                      dataKey="value"
                      innerRadius={66}
                      outerRadius={95}
                      stroke="none"
                    >
                      {(distribution.length
                        ? distribution
                        : [{ color: "#e8eaf0" }]
                      ).map((d, i) => (
                        <Cell fill={d.color} key={i} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-label">
                  <strong>{money(totalPotential)}</strong>
                  <small>USD / MES</small>
                </div>
              </div>
              <div className="chart-legend">
                {distribution.map((d) => (
                  <div key={d.name}>
                    <span
                      style={{ background: d.color }}
                      className="color-swatch"
                    />
                    <span>{d.name}</span>
                    <strong>{money(d.value)}</strong>
                  </div>
                ))}
              </div>
              <p className="chart-note">
                No detectamos inactividad ni egresos confirmados a partir de
                estos archivos.
              </p>
            </aside>
          </div>
          <div className="bottom-actions">
            <Button onClick={() => setPage("checklist")}>
              <IconClipboardCheck size={19} /> Ver checklist de bajas{" "}
              <span className="button-count">{selected.length}</span>
            </Button>
            <Button variant="secondary" onClick={() => setModal("close")}>
              <IconRefresh size={19} /> Nueva auditoría
            </Button>
            <Button variant="ghost" onClick={() => setModal("compare")}>
              <IconArrowsDiff size={19} /> Comparar períodos
            </Button>
          </div>
          <div className="snapshot-strip">
            <label>
              Snapshot completo
              <select
                value={snapshotProvider}
                onChange={(e) => setSnapshotProvider(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={exportSnapshot}
              disabled={!snapshotProvider}
            >
              <IconDownload size={16} /> Descargar snapshot
            </Button>
            <span>
              Para comparar auditorías del mismo proveedor. No equivale al
              checklist.
            </span>
          </div>
        </div>
      )}

      {page === "checklist" && (
        <div className="checklist-content">
          <button className="back-link" onClick={() => setPage("results")}>
            <IconChevronLeft size={17} /> Volver a los casos
          </button>
          <div className="page-heading">
            <h1>Checklist de bajas — revisión y exportación</h1>
            <p>
              Incluye únicamente las cuentas que revisaste y confirmaste. La
              baja se ejecuta manualmente en cada plataforma.
            </p>
          </div>
          <div className="checklist-summary">
            <IconClipboardCheck size={32} />
            <div>
              <h2>
                {counted(
                  selected.length,
                  "cuenta revisada",
                  "cuentas revisadas",
                )}
              </h2>
              <p>
                Ahorro potencial conocido:{" "}
                <strong>{money(stats.selectedSavings)} / mes</strong> ·{" "}
                {counted(
                  stats.selectedUnknownCostCount,
                  "cuenta sin costo informado",
                  "cuentas sin costo informado",
                )}
              </p>
            </div>
            <span className="badge amber">Bajas pendientes de ejecutar</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>COLABORADOR</th>
                  <th>PLATAFORMA / PLAN</th>
                  <th>COSTO MENSUAL</th>
                  <th>RESPONSABLE</th>
                  <th>NOTA DE REVISIÓN</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small className="block">{c.email}</small>
                    </td>
                    <td>
                      {c.provider}
                      <small className="block">{c.plan}</small>
                    </td>
                    <td>{c.cost === null ? "Sin informar" : money(c.cost)}</td>
                    <td>{c.assignee}</td>
                    <td>{c.note || "Sin nota"}</td>
                    <td>
                      <button
                        className="row-button"
                        onClick={() =>
                          setCandidates((previous) =>
                            previous.map((p) =>
                              p.id === c.id ? { ...p, review: "pending" } : p,
                            ),
                          )
                        }
                      >
                        Quitar del checklist
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!selected.length && (
              <div className="empty-state">
                <IconClipboardCheck size={36} />
                <h3>Todavía no hay cuentas confirmadas</h3>
                <p>
                  Volvé a los casos y revisá una ficha para armar el checklist.
                </p>
                <Button onClick={() => setPage("results")}>
                  Revisar casos
                </Button>
              </div>
            )}
          </div>
          <div className="export-grid">
            <section>
              <IconFileSpreadsheet size={28} />
              <h3>Checklist Excel</h3>
              <p>
                Cuentas revisadas, responsables, notas e importes para trabajar
                con el equipo.
              </p>
              <Button
                disabled={!selected.length}
                onClick={() => exportReport("xlsx")}
              >
                <IconDownload size={17} /> Descargar Excel
              </Button>
            </section>
            <section>
              <IconFileTypePdf size={28} />
              <h3>Resumen PDF</h3>
              <p>
                Reporte de la auditoría con el checklist y el total de ahorro
                potencial conocido.
              </p>
              <Button
                variant="secondary"
                disabled={!selected.length}
                onClick={() => exportReport("pdf")}
              >
                <IconDownload size={17} /> Descargar PDF
              </Button>
            </section>
            <section>
              <IconShieldCheck size={28} />
              <h3>Cerrar y borrar los datos</h3>
              <p>
                Eliminá los archivos y las decisiones de esta sesión. Las
                descargas quedan en tu equipo.
              </p>
              <Button variant="ghost" onClick={() => setModal("close")}>
                <IconTrash size={17} /> Cerrar auditoría
              </Button>
            </section>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setModal("pilot");
              setError("");
            }}
          >
            Registrar una ejecución real del piloto
          </button>
        </div>
      )}

      {page === "closed" && (
        <div className="closed-content">
          <span className="closed-icon">
            <IconShieldCheck size={54} />
          </span>
          <h1>Auditoría cerrada</h1>
          <p>
            Los CSV, las cuentas y las decisiones de esta sesión se eliminaron
            de la app.
          </p>
          <div className="closed-info">
            <strong>
              {counted(closedCount, "cuenta incluida", "cuentas incluidas")} en
              el último checklist
            </strong>
            <span>
              Las exportaciones que descargaste permanecen en tu equipo.
            </span>
          </div>
          <Button
            onClick={() => {
              setCreatedAt(new Date().toISOString());
              setPage("load");
              setNotice("");
              setClosedCount(0);
            }}
          >
            <IconPlus size={19} /> Empezar una nueva auditoría
          </Button>
        </div>
      )}
      <footer>
        <span>SaaSGuard Express · Grupo 05</span>
        <span>CSV local · Revisión humana · Sin bajas automáticas</span>
      </footer>

      {active && (
        <Modal
          title="Ficha del colaborador — revisión del caso"
          wide
          onClose={() => {
            setActive(null);
            setError("");
          }}
        >
          <p className="muted">
            El email de esta cuenta no aparece en la nómina cargada. Verificá
            egresos, alias y excepciones antes de confirmar.
          </p>
          <div className="profile-card">
            <span className="avatar">
              {active.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h3>{active.name || active.email}</h3>
              <p>{active.originalEmail || active.email}</p>
              <small>Email normalizado: {active.email}</small>
            </div>
            <span className="badge rose">No figura en RRHH</span>
          </div>
          <div className="license-detail">
            <h3>{active.provider}</h3>
            <span className="badge neutral">
              {active.plan || "Plan no informado"}
            </span>
            <p>
              No verificamos actividad, rol administrador ni espacio almacenado.
            </p>
            <div className="review-fields">
              <label>
                Costo mensual USD
                <input
                  aria-label="Costo del caso"
                  inputMode="decimal"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  placeholder="Sin informar"
                />
              </label>
              <label>
                Responsable de la revisión
                <input
                  value={assignee}
                  maxLength={80}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Nombre del responsable"
                />
              </label>
            </div>
            <label className="block-label">
              Nota de revisión
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Por ejemplo: verificado con RRHH; no corresponde a un alias de una cuenta vigente."
              />
            </label>
            <details className="alias-check">
              <summary>Verificar posibles alias en la nómina</summary>
              <p>
                Buscá manualmente en RRHH. No unimos cuentas por similitud del
                nombre.
              </p>
              <ul>
                {employees
                  .filter(
                    (e) =>
                      e.name &&
                      active.name &&
                      e.name
                        .toLowerCase()
                        .includes(active.name.split(" ")[0].toLowerCase()),
                  )
                  .slice(0, 10)
                  .map((e) => (
                    <li key={e.email}>
                      {e.name} · {e.email}
                    </li>
                  ))}
              </ul>
              <p>
                Una coincidencia de nombre no confirma que las cuentas
                pertenezcan a la misma persona.
              </p>
            </details>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="review-actions">
            <Button onClick={() => saveReview("confirmed")}>
              <IconCheck size={19} /> Confirmar y agregar al checklist
            </Button>
            <Button variant="secondary" onClick={() => saveReview("retained")}>
              Mantener cuenta / excepción
            </Button>
            <Button variant="ghost" onClick={() => saveReview("pending")}>
              Guardar para revisar con RRHH
            </Button>
          </div>
          <p className="modal-footnote">
            Confirmar agrega una tarea de baja al checklist. No revoca accesos
            ni acredita ahorro realizado.
          </p>
        </Modal>
      )}
      {modal === "close" && (
        <Modal
          title="Cerrar auditoría y eliminar datos"
          onClose={() => setModal(null)}
        >
          <p>
            Se eliminarán los CSV, los resultados y las decisiones de esta
            sesión. Descargá el checklist antes de cerrar si querés conservarlo.
          </p>
          <p className="muted">
            Los archivos ya descargados y los conteos del piloto guardados
            aparte permanecen en tu equipo.
          </p>
          <div className="review-actions">
            <Button variant="danger" onClick={() => clearAudit()}>
              <IconTrash size={18} /> Cerrar y borrar datos
            </Button>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Seguir revisando
            </Button>
          </div>
        </Modal>
      )}
      {modal === "compare" && (
        <Modal
          title="Comparar auditorías del mismo proveedor"
          wide
          onClose={closeComparison}
        >
          <p className="muted">
            Cargá dos snapshots completos exportados por SaaSGuard. Un checklist
            parcial no sirve para comparar.
          </p>
          <div className="snapshot-inputs">
            {([0, 1] as const).map((i) => (
              <label key={i}>
                {i === 0 ? "Auditoría anterior" : "Auditoría actual"}
                <input
                  aria-label={i === 0 ? "Snapshot anterior" : "Snapshot actual"}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      void readSnapshot(e.target.files[0], i);
                  }}
                />
                <small>
                  {snapshots[i]
                    ? "Archivo leído"
                    : "JSON completo del mismo proveedor"}
                </small>
              </label>
            ))}
          </div>
          <Button
            disabled={!snapshots[0] || !snapshots[1]}
            onClick={runComparison}
          >
            <IconArrowsDiff size={18} /> Comparar snapshots
          </Button>
          {comparison && (
            <div className="comparison-result">
              <h3>Comparación completada</h3>
              <p>
                {comparison.previous.provider} · Anterior:{" "}
                {new Date(comparison.previous.createdAt).toLocaleString(
                  "es-AR",
                  { timeZone: "UTC", hour12: false },
                )}{" "}
                UTC (
                {counted(
                  comparison.previous.allLicenseCount,
                  "licencia",
                  "licencias",
                )}
                ) · Actual:{" "}
                {new Date(comparison.next.createdAt).toLocaleString("es-AR", {
                  timeZone: "UTC",
                  hour12: false,
                })}{" "}
                UTC (
                {counted(
                  comparison.next.allLicenseCount,
                  "licencia",
                  "licencias",
                )}
                )
              </p>
              <div className="comparison-counts">
                {(
                  [
                    ["Nuevas", comparison.new.map((c) => c.email)],
                    ["Persistentes", comparison.persistent.map((c) => c.email)],
                    [
                      "Ya no aparecen",
                      comparison.noLongerPresent.map((c) => c.email),
                    ],
                    [
                      "Cambios de costo",
                      comparison.costChanges.map(
                        (c) =>
                          `${c.email}: ${c.previousCost === null ? "Sin informar" : money(c.previousCost)} → ${c.nextCost === null ? "Sin informar" : money(c.nextCost)}`,
                      ),
                    ],
                  ] as [string, string[]][]
                ).map(([label, entries]) => (
                  <details key={label}>
                    <summary>
                      <strong>{entries.length}</strong>
                      <span>{label}</span>
                    </summary>
                    {entries.length ? (
                      <ul>
                        {entries.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No hay cuentas en este grupo.</p>
                    )}
                  </details>
                ))}
              </div>
              <p>
                Que una cuenta deje de aparecer no confirma una baja ni un
                ahorro realizado. Los snapshots se eliminan al cerrar esta
                ventana.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {modal === "pilot" && (
        <Modal
          title="Registro agregado del piloto"
          onClose={() => {
            setModal(null);
            setError("");
          }}
        >
          <p>
            Guardamos sólo un código de organización, fecha y conteos en este
            navegador. No guardamos emails, nombres ni archivos.
          </p>
          <label className="block-label">
            Código de organización
            <input
              aria-label="Código del piloto"
              value={pilotCode}
              onChange={(e) => setPilotCode(e.target.value)}
              placeholder="Por ejemplo: PILOTO_01"
              maxLength={24}
            />
          </label>
          <Button disabled={pilotSaved || isDemo} onClick={registerPilot}>
            {pilotSaved
              ? "Ejecución registrada"
              : isDemo
                ? "La demo no cuenta como piloto"
                : "Registrar ejecución real"}
          </Button>
          <p>
            {pilotRuns.length} ejecuciones registradas ·{" "}
            {new Set(pilotRuns.map((p) => p.organizationCode)).size}{" "}
            organizaciones
          </p>
          <small>
            Son registros declarados por el equipo. No validan demanda ni
            Product Market Fit.
          </small>
          <Button
            variant="ghost"
            onClick={() => {
              clearPilotRuns();
              setPilotRuns([]);
              setNotice("Registro agregado del piloto eliminado.");
            }}
          >
            Borrar registro del piloto
          </Button>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </main>
  );
}
function Stat({
  label,
  value,
  suffix,
  caption,
  tone,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  caption: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <article className={`stat ${tone}`}>
      <div>
        <h3>{label}</h3>
        <p className="stat-value">
          {value} <span>{suffix}</span>
        </p>
        <small>{caption}</small>
      </div>
      <span className="stat-icon">{icon}</span>
    </article>
  );
}
