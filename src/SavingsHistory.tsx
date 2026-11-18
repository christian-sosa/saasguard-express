import { useCallback, useEffect, useRef, useState } from "react";
import { money } from "./labels";
import { loadSavingsHistory, SavingsHistoryRequestError, type SavingsHistoryEntry } from "./savings-history-client";

const savedDate = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function SavingsHistory({ sessionTag }: { sessionTag?: string }) {
  const [entries, setEntries] = useState<SavingsHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const request = useRef<AbortController | null>(null);

  const loadPage = useCallback(async (cursor: string | null) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const page = await loadSavingsHistory(cursor, sessionTag, controller.signal);
      if (controller.signal.aborted) return;
      setEntries((existing) => cursor ? [...existing, ...page.entries] : page.entries);
      setNextCursor(page.nextCursor);
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (needsMatchingSession(failure)) {
        setEntries([]);
        setNextCursor(null);
      }
      setError(failure instanceof Error ? failure : new Error("No pudimos cargar tu historial."));
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setLoading(false);
      }
    }
  }, [sessionTag]);

  useEffect(() => {
    void loadPage(null);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [loadPage]);

  return (
    <div className="savings-history">
      <p className="muted">Cada resumen muestra el ahorro potencial mensual de una auditoría. Las bajas y el impacto en la factura se verifican fuera de SaaSGuard.</p>
      {entries.length > 0 && (
        <ul className="savings-history-list" aria-label="Auditorías guardadas">
          {entries.map((entry) => (
            <li key={entry.auditId} className="savings-history-entry">
              <div className="savings-history-heading">
                <time dateTime={entry.savedAt}>{savedDate.format(new Date(entry.savedAt))}</time>
                <span>{entry.providers.join(" · ")}</span>
              </div>
              <dl className="savings-history-metrics">
                <div>
                  <dt>Potencial mensual</dt>
                  <dd>{money(entry.potentialSavingsCents / 100)}</dd>
                  <small>{entry.candidateCount} candidatas · {entry.unknownCostCount} sin costo informado</small>
                </div>
                <div>
                  <dt>Subtotal del checklist</dt>
                  <dd>{money(entry.selectedSavingsCents / 100)}</dd>
                  <small>{entry.selectedCount} seleccionadas · {entry.selectedUnknownCostCount} sin costo informado</small>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      {loading && <p role="status">Cargando historial…</p>}
      {error && <p role="alert" className="field-error">{error.message}</p>}
      {!loading && !error && !entries.length && (
        <p role="status">Todavía no guardaste resúmenes. Podés guardar uno desde el resultado o el checklist de una auditoría.</p>
      )}
      {(nextCursor !== null || (error && !needsMatchingSession(error))) && (
        <button type="button" className="button ghost" disabled={loading} onClick={() => void loadPage(nextCursor)}>
          {error ? "Reintentar" : "Cargar más auditorías"}
        </button>
      )}
    </div>
  );
}

function needsMatchingSession(error: unknown) {
  return error instanceof SavingsHistoryRequestError && (error.status === 401 || error.status === 409);
}
