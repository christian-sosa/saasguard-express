import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconShieldCheck, IconAlertTriangle } from "@tabler/icons-react";
import {
  GSI_SCRIPT_URL,
  authConfig,
  clearStoredUser,
  parseGoogleCredential,
  readStoredUser,
  storeUser,
  type AuthConfig,
  type GoogleUser,
} from "./auth";

interface GoogleIdApi {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    ux_mode?: "popup" | "redirect";
    hd?: string;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("No pudimos cargar el inicio de sesión de Google."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function LoginScreen({
  config,
  onUser,
}: {
  config: AuthConfig;
  onUser: (user: GoogleUser) => void;
}) {
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadGoogleScript()
      .then(() => {
        const id = window.google?.accounts.id;
        if (!active || !id || !button.current) return;
        id.initialize({
          client_id: config.clientId,
          auto_select: false,
          ux_mode: "popup",
          hd: config.allowedDomain,
          callback: (response) => {
            try {
              if (!response.credential) throw new Error("Google no devolvió una credencial.");
              onUser(parseGoogleCredential(response.credential, config));
            } catch (e) {
              setError(e instanceof Error ? e.message : "No pudimos iniciar sesión.");
            }
          },
        });
        id.renderButton(button.current, {
          theme: "filled_blue",
          size: "large",
          shape: "pill",
          text: "signin_with",
          locale: "es-419",
          width: 280,
        });
      })
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [config, onUser]);

  return (
    <main className="login-shell">
      <section className="login-card">
        <img src="/saasguard-mark.png" alt="" width={56} height={56} />
        <h1>SaaSGuard Express</h1>
        <p>
          Ingresá con tu cuenta de Google para auditar licencias SaaS contra la
          nómina vigente.
        </p>
        <div ref={button} className="google-button" />
        {error && (
          <p role="alert" className="field-error">
            <IconAlertTriangle size={16} /> {error}
          </p>
        )}
        <p className="login-note">
          <IconShieldCheck size={16} /> Google sólo identifica a quien opera la
          app: no damos acceso a tus plataformas ni leemos tu Workspace. La
          nómina y las exportaciones se siguen procesando en este navegador.
          {config.allowedDomain
            ? ` Sólo se admiten cuentas de ${config.allowedDomain}.`
            : ""}
        </p>
      </section>
    </main>
  );
}

/** Without VITE_GOOGLE_CLIENT_ID the app keeps working without sign-in, as before. */
export function AuthGate({
  children,
}: {
  children: (user: GoogleUser | null, signOut: (() => void) | null) => ReactNode;
}) {
  const [config] = useState(() => authConfig());
  const [user, setUser] = useState<GoogleUser | null>(() =>
    config ? readStoredUser(config) : null,
  );

  const signIn = useCallback((next: GoogleUser) => {
    storeUser(next);
    setUser(next);
  }, []);

  const signOut = useCallback(() => {
    clearStoredUser();
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(signOut, Math.max(0, user.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [user, signOut]);

  if (!config) return <>{children(null, null)}</>;
  if (!user) return <LoginScreen config={config} onUser={signIn} />;
  return <>{children(user, signOut)}</>;
}
