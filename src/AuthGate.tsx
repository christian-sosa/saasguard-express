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
  type GoogleConfig,
  type SessionUser,
} from "./auth";

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
  config,
  onUser,
  onError,
}: {
  config: GoogleConfig;
  onUser: (user: SessionUser) => void;
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
          client_id: config.clientId,
          auto_select: false,
          ux_mode: "popup",
          callback: (response) => {
            try {
              if (!response.credential)
                throw new Error("Google no devolvió una credencial.");
              onUser(parseGoogleCredential(response.credential, config));
            } catch (e) {
              onError(e instanceof Error ? e.message : "No pudimos iniciar sesión.");
            }
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
  }, [config, onUser, onError]);

  return <div ref={button} className="google-button" />;
}

const limiter = new AttemptLimiter();

function LoginScreen({
  google,
  onUser,
}: {
  google: GoogleConfig | null;
  onUser: (user: SessionUser) => void;
}) {
  const [identifier, setIdentifier] = useState(() => readRememberedIdentifier());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(readRememberedIdentifier()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const locked = limiter.remainingLockMs();
    if (locked) {
      setError(`Demasiados intentos. Probá de nuevo en ${Math.ceil(locked / 1000)} segundos.`);
      return;
    }
    setBusy(true);
    try {
      const user = await signInWithPassword(identifier, password);
      limiter.succeed();
      rememberIdentifier(remember ? identifier : null);
      onUser(user);
    } catch (e) {
      limiter.fail();
      setPassword("");
      setError(e instanceof Error ? e.message : "No pudimos iniciar sesión.");
    } finally {
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
            Pedile a quien administra SaaSGuard que te asigne una nueva. Las
            cuentas de prueba están en docs/usuarios-de-prueba.md del repositorio.
          </p>
        )}
        {google && (
          <>
            <span className="login-or">ó</span>
            <GoogleButton config={google} onUser={onUser} onError={setError} />
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

export function AuthGate({
  children,
}: {
  children: (user: SessionUser, signOut: () => void) => ReactNode;
}) {
  const [google] = useState(() => googleConfig());
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser(google));

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

  if (!user) return <LoginScreen google={google} onUser={signIn} />;
  return <>{children(user, signOut)}</>;
}
