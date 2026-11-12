import type { SessionUser } from "./auth";

interface SessionResponse {
  user: SessionUser | null;
  googleClientId: string | null;
}

type SessionAction =
  | { action: "password"; identifier: string; password: string }
  | { action: "google"; credential: string }
  | { action: "logout" };

async function authRequest(init: RequestInit): Promise<SessionResponse> {
  let response: Response;
  try {
    response = await fetch("/api/auth", {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("No pudimos conectar con el servicio de ingreso.");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || "El servicio de ingreso no está disponible.");
  }
  if (!result || !Object.hasOwn(result, "user")) {
    throw new Error("El servicio de ingreso devolvió una respuesta inesperada.");
  }
  return result;
}

export function loadSession(signal: AbortSignal) {
  return authRequest({ method: "GET", signal });
}

export async function requestSession(action: SessionAction) {
  const result = await authRequest({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return result.user;
}
