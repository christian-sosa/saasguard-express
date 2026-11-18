import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSavingsHistory, saveSavingsHistory, savingsHistorySummary } from "./savings-history-client";

describe("savings history summary", () => {
  it("sends only allowed aggregate fields and groups providers outside the app list", () => {
    const stats = {
      potentialSavingsCents: 2750,
      selectedSavingsCents: 0,
      candidateCount: 3,
      selectedCount: 2,
      unknownCostCount: 1,
      selectedUnknownCostCount: 1,
      employeeEmail: "empleado@example.test",
    };
    expect(savingsHistorySummary("c7c97f8a-534d-43dd-a97f-38196b43d54e", [
      " slack ", "SLACK", "Google Workspace", "persona@example.test", "Otro proveedor",
    ], stats)).toEqual({
      auditId: "c7c97f8a-534d-43dd-a97f-38196b43d54e",
      providers: ["Slack", "Google Workspace", "Otro"],
      potentialSavingsCents: 2750,
      selectedSavingsCents: 0,
      candidateCount: 3,
      selectedCount: 2,
      unknownCostCount: 1,
      selectedUnknownCostCount: 1,
    });
  });
});

describe("savings history requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the matching session tag on list and save requests without storing it in the summary", async () => {
    const summary = savingsHistorySummary("c7c97f8a-534d-43dd-a97f-38196b43d54e", ["Slack"], {
      potentialSavingsCents: 0,
      selectedSavingsCents: 0,
      candidateCount: 0,
      selectedCount: 0,
      unknownCostCount: 0,
      selectedUnknownCostCount: 0,
    });
    const entry = { ...summary, savedAt: "2026-11-18T13:00:00.000Z" };
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ entries: [entry], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({ entry }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;

    await expect(loadSavingsHistory("next page", "session-a", signal)).resolves.toEqual({ entries: [entry], nextCursor: null });
    await expect(saveSavingsHistory(summary, "session-a", signal)).resolves.toEqual(entry);

    expect(fetch.mock.calls[0][0]).toBe("/api/savings-history?cursor=next+page");
    expect(fetch.mock.calls[1][0]).toBe("/api/savings-history");
    for (const [, request] of fetch.mock.calls) {
      expect(request.headers.get("X-SaaSGuard-Session")).toBe("session-a");
      expect(request.credentials).toBe("same-origin");
    }
    expect(fetch.mock.calls[1][1].method).toBe("PUT");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(summary);
  });

  it("preserves session errors from the server and lets it handle a legacy session without a tag", async () => {
    const message = "La sesión cambió en otra pestaña. Recargá la página antes de usar el historial.";
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: message }, { status: 409 }));
    vi.stubGlobal("fetch", fetch);

    await expect(loadSavingsHistory(null, undefined, new AbortController().signal)).rejects.toMatchObject({
      status: 409,
      message,
    });
    expect(fetch.mock.calls[0][1].headers.has("X-SaaSGuard-Session")).toBe(false);
  });
});
