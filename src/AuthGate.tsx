import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconHelpCircle,
  IconLock,
  IconLogin2,
  IconMail,
  IconUser,
} from "@tabler/icons-react";
import {
  AttemptLimiter,
  GSI_SCRIPT_URL,
  clearStoredUser,
  googleConfig,
  parseGoogleCredential,
  readRememberedIdentifier,
  readStoredUser,
  rememberIdentifier,
  signInWithPassword,
  storeUser,
  type SessionUser,
} from "./auth";
import { loadSession, requestSession } from "./auth-client";

interface GoogleIdApi {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    ux_mode?: "popup" | "redirect";
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

function GoogleButton({
  clientId,
  onCredential,
  onError,
}: {
  clientId: string;
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const button = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadGoogleScript()
      .then(() => {
        const id = window.google?.accounts.id;
        if (!active || !id || !button.current) return;
        id.initialize({
          client_id: clientId,
          auto_select: false,
          ux_mode: "popup",
          callback: ({ credential }) => {
            if (!active) return;
            if (!credential) {
              onError("Google no devolvió una credencial.");
              return;
            }
            void onCredential(credential);
          },
        });
        id.renderButton(button.current, {
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          locale: "es-419",
          width: Math.min(400, button.current.clientWidth || 340),
        });
      })
      .catch((e: Error) => active && onError(e.message));
    return () => {
      active = false;
    };
  }, [clientId, onCredential, onError]);

  return <div ref={button} className="google-button" />;
}

const limiter = new AttemptLimiter();

function LoginScreen({
  googleClientId,
  authenticatePassword,
  authenticateGoogle,
  demo,
  onUser,
}: {
  googleClientId: string | null;
  authenticatePassword: (identifier: string, password: string) => Promise<SessionUser>;
  authenticateGoogle: (credential: string) => Promise<SessionUser>;
  demo: boolean;
  onUser: (user: SessionUser) => void;
}) {
  const [identifier, setIdentifier] = useState(() => readRememberedIdentifier());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(readRememberedIdentifier()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const signingIn = useRef(false);

  const handleGoogle = useCallback(async (credential: string) => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError("");
    try {
      onUser(await authenticateGoogle(credential));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar sesión.");
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }, [authenticateGoogle, onUser]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (signingIn.current) return;
    const locked = limiter.remainingLockMs();
    if (locked) {
      setError(`Demasiados intentos. Probá de nuevo en ${Math.ceil(locked / 1000)} segundos.`);
      return;
    }
    signingIn.current = true;
    setBusy(true);
    setError("");
    try {
      const user = await authenticatePassword(identifier, password);
      limiter.succeed();
      rememberIdentifier(remember ? identifier : null);
      onUser(user);
    } catch (e) {
      limiter.fail();
      setPassword("");
      setError(e instanceof Error ? e.message : "No pudimos iniciar sesión.");
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <IconUser size={64} className="login-avatar" aria-hidden />
        <h1>Bienvenido a SaaSGuard Express</h1>
        <p className="login-subtitle">Ingresá con tus credenciales para acceder</p>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <label className="login-field">
            <span className="login-icon">
              <IconMail size={20} />
            </span>
            <input
              aria-label="Email o usuario"
              autoComplete="username"
              placeholder="Ingresá tu email o usuario"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </label>
          <label className="login-field">
            <span className="login-icon">
              <IconLock size={20} />
            </span>
            <input
              aria-label="Contraseña"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              placeholder="Ingresá tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-eye"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </label>
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Recordar mis datos
          </label>
          {error && (
            <p role="alert" className="login-error">
              <IconAlertTriangle size={16} /> {error}
            </p>
          )}
          <button type="submit" className="login-submit" disabled={busy}>
            <IconLogin2 size={22} /> {busy ? "Verificando…" : "Iniciar sesión"}
          </button>
        </form>
        <button type="button" className="login-link" onClick={() => setHelp((v) => !v)}>
          <IconHelpCircle size={16} /> ¿Olvidaste tu contraseña?
        </button>
        {help && (
          <p className="login-help">
            Pedile a quien administra SaaSGuard que te asigne una nueva.
            {demo && " Las cuentas de prueba están en docs/usuarios-de-prueba.md del repositorio."}
          </p>
        )}
        {googleClientId && (
          <>
            <span className="login-or">ó</span>
            <GoogleButton clientId={googleClientId} onCredential={handleGoogle} onError={setError} />
          </>
        )}
        <p className="login-note">
          Recordar mis datos guarda sólo tu usuario en este navegador. La nómina
          y las exportaciones se procesan acá y no se envían a ningún servidor.
        </p>
      </section>
    </main>
  );
}

interface AuthGateProps {
  children: (user: SessionUser, signOut: () => void) => ReactNode;
}

function DemoAuthGate({ children }: AuthGateProps) {
  const [google] = useState(() => import.meta.env.DEV ? googleConfig() : null);
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser(google));
  const authenticateGoogle = useCallback(async (credential: string) => {
    if (!google) throw new Error("El ingreso con Google no está configurado.");
    return parseGoogleCredential(credential, google);
  }, [google]);

  const signIn = useCallback((next: SessionUser) => {
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

  if (!user) return (
    <LoginScreen
      googleClientId={google?.clientId ?? null}
      authenticatePassword={signInWithPassword}
      authenticateGoogle={authenticateGoogle}
      demo
      onUser={signIn}
    />
  );
  return <>{children(user, signOut)}</>;
}

async function passwordSession(identifier: string, password: string) {
  const user = await requestSession({ action: "password", identifier, password });
  if (!user) throw new Error("No pudimos iniciar sesión.");
  return user;
}

async function googleSession(credential: string) {
  const user = await requestSession({ action: "google", credential });
  if (!user) throw new Error("No pudimos iniciar sesión.");
  return user;
}

function ServerAuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal).then((session) => {
      if (controller.signal.aborted) return;
      setUser(session.user);
      setGoogleClientId(session.googleClientId);
      setLoaded(true);
    }).catch((e: Error) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [retry]);

  const signOut = useCallback(() => {
    setError("");
    void requestSession({ action: "logout" }).then(() => {
      window.google?.accounts.id.disableAutoSelect();
      setUser(null);
    }).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => setUser(null), Math.max(0, user.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [user]);

  if (!loaded) return (
    <main className="login-shell" aria-busy={!error}>
      <section className="login-card">
        <h1>SaaSGuard Express</h1>
        {error ? <>
          <p role="alert" className="login-error">{error}</p>
          <button type="button" className="login-submit" onClick={() => {
            setError("");
            setRetry((value) => value + 1);
          }}>Reintentar</button>
        </> : <p role="status">Comprobando la sesión…</p>}
      </section>
    </main>
  );
  if (!user) return (
    <LoginScreen googleClientId={googleClientId} authenticatePassword={passwordSession}
      authenticateGoogle={googleSession} demo={false} onUser={setUser} />
  );
  return <>{error && <p role="alert" className="login-error">{error}</p>}{children(user, signOut)}</>;
}

export const AuthGate = import.meta.env.VITE_SAASGUARD_SERVER_AUTH === "true"
  ? ServerAuthGate : DemoAuthGate;
