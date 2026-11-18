import type { Summary } from "./domain";

export const DEFAULT_PROVIDERS = [
  "Google Workspace", "Slack", "Jira", "Trello", "Figma", "Zoom", "Notion",
] as const;
type HistoryProvider = typeof DEFAULT_PROVIDERS[number] | "Otro";

type SavingsMetrics = Pick<Summary,
  "potentialSavingsCents" | "selectedSavingsCents" | "candidateCount" |
  "selectedCount" | "unknownCostCount" | "selectedUnknownCostCount"
>;

export interface SavingsHistorySummary extends SavingsMetrics {
  auditId: string;
  providers: HistoryProvider[];
}

export interface SavingsHistoryEntry extends SavingsHistorySummary {
  savedAt: string;
}

interface SavingsHistoryPage {
  entries: SavingsHistoryEntry[];
  nextCursor: string | null;
}

export function savingsHistorySummary(
  auditId: string, providers: string[], stats: SavingsMetrics,
): SavingsHistorySummary {
  const groups = new Set<HistoryProvider>(providers.map((name) => {
    const normalized = name.trim().toLowerCase();
    return DEFAULT_PROVIDERS.find((provider) => provider.toLowerCase() === normalized) ?? "Otro";
  }));
  return {
    auditId,
    providers: [...groups],
    potentialSavingsCents: stats.potentialSavingsCents,
    selectedSavingsCents: stats.selectedSavingsCents,
    candidateCount: stats.candidateCount,
    selectedCount: stats.selectedCount,
    unknownCostCount: stats.unknownCostCount,
    selectedUnknownCostCount: stats.selectedUnknownCostCount,
  };
}

const endpoint = "/api/savings-history";

export class SavingsHistoryRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function historyRequest(url: string, init: RequestInit, sessionTag: string | undefined) {
  const headers = new Headers(init.headers);
  if (sessionTag) headers.set("X-SaaSGuard-Session", sessionTag);
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new Error("No pudimos conectar con el historial de ahorro.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SavingsHistoryRequestError(response.status, result?.error || "El historial de ahorro no está disponible.");
  }
  return result;
}

export async function loadSavingsHistory(cursor: string | null, sessionTag: string | undefined, signal: AbortSignal): Promise<SavingsHistoryPage> {
  const url = cursor ? `${endpoint}?${new URLSearchParams({ cursor })}` : endpoint;
  const result = await historyRequest(url, { method: "GET", signal }, sessionTag);
  if (!Array.isArray(result?.entries) || (result.nextCursor !== null && typeof result.nextCursor !== "string")) {
    throw new Error("El historial de ahorro devolvió una respuesta inesperada.");
  }
  return result;
}

export async function saveSavingsHistory(summary: SavingsHistorySummary, sessionTag: string | undefined, signal: AbortSignal): Promise<SavingsHistoryEntry> {
  const result = await historyRequest(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(summary),
    signal,
  }, sessionTag);
  if (result?.entry?.auditId !== summary.auditId) {
    throw new Error("El historial de ahorro no confirmó el guardado.");
  }
  return result.entry;
}
