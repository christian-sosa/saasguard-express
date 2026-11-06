// Browser check for the two findings of the PR #2 review (synthetic data, stubbed Google client).
// Run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright && node docs/evidencia/sprint3/login-robusto.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const PORT = 5191;
const APP = `http://localhost:${PORT}/`;
const CLIENT_ID = 'client-de-prueba.apps.googleusercontent.com';
const GOOGLE_EMAIL = 'lector.google@example.test';

const CREDENTIALS = Object.fromEntries(
  [...fs.readFileSync(path.join(REPO, 'docs/usuarios-de-prueba.md'), 'utf8').matchAll(/^\| `([^`]+)` \| `[^`]+` \| `([^`]+)` \|/gm)]
    .map(([, user, password]) => [user, password]));

const results = [];
async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail });
    console.log(`OK   ${name}: ${detail}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message.split('\n')[0] });
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  }
}

const blockStorage = (name) => {
  Object.defineProperty(window, name, {
    configurable: true,
    get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
  });
};

// Keeps the callback that the app registers, so the test decides when Google answers.
const stubGoogle = () => {
  window.google = { accounts: { id: {
    initialize(options) { window.__googleCallback = options.callback; },
    renderButton(element) { element.textContent = 'Google de prueba'; },
    disableAutoSelect() {},
  } } };
};

async function signIn(page, username) {
  await page.getByLabel('Email o usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(CREDENTIALS[username]);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: /Conciliación Express/ }).waitFor();
}

function googleToken() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 3600,
    email: GOOGLE_EMAIL, email_verified: true, name: 'Lector Google',
  })}.signature`;
}

(async () => {
  process.env.VITE_GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.VITE_GOOGLE_ALLOWED_EMAILS = `${GOOGLE_EMAIL}:viewer`;
  const { createServer } = await import('vite');
  const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ channel: 'chrome' });
  const newPage = async (...scripts) => {
    const context = await browser.newContext({ locale: 'es-AR' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [script, arg] of scripts) await page.addInitScript(script, arg);
    return { page, errors };
  };

  for (const storage of ['sessionStorage', 'localStorage']) {
    await check(`${storage} bloqueado`, async () => {
      const { page, errors } = await newPage([stubGoogle], [blockStorage, storage]);
      await page.goto(APP);
      await page.getByRole('heading', { name: 'Bienvenido a SaaSGuard Express' }).waitFor({ timeout: 5000 });
      await signIn(page, 'admin');
      if (errors.length) throw new Error(`Errores de página: ${errors.join(' | ')}`);
      return 'la pantalla de ingreso se ve y se puede entrar con contraseña';
    });
  }

  await check('respuesta tardía de Google después del ingreso con contraseña', async () => {
    const { page, errors } = await newPage([stubGoogle]);
    await page.goto(APP);
    await page.getByRole('heading', { name: 'Bienvenido a SaaSGuard Express' }).waitFor();
    await page.waitForFunction(() => typeof window.__googleCallback === 'function');
    await signIn(page, 'admin');
    await page.getByRole('button', { name: 'Probar con datos de ejemplo' }).click();
    await page.getByRole('button', { name: 'Auditar y Cruzar Datos' }).click();
    await page.getByRole('heading', { name: 'Casos detectados' }).waitFor({ timeout: 8000 });
    await page.evaluate((credential) => window.__googleCallback({ credential }), googleToken());
    await page.waitForTimeout(300);
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saasguard.sessionUser')));
    if (stored.email === GOOGLE_EMAIL) throw new Error('La respuesta tardía cambió la cuenta');
    if (stored.role !== 'admin') throw new Error(`El rol pasó a ${stored.role}`);
    await page.getByRole('heading', { name: 'Casos detectados' }).waitFor({ timeout: 2000 });
    if (errors.length) throw new Error(`Errores de página: ${errors.join(' | ')}`);
    return `la cuenta sigue en ${stored.username} con rol ${stored.role} y la auditoría abierta`;
  });

  await check('ingreso con Google mientras la pantalla de ingreso está activa', async () => {
    const { page } = await newPage([stubGoogle]);
    await page.goto(APP);
    await page.waitForFunction(() => typeof window.__googleCallback === 'function');
    await page.evaluate((credential) => window.__googleCallback({ credential }), googleToken());
    await page.getByRole('heading', { name: /Conciliación Express/ }).waitFor();
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saasguard.sessionUser')));
    if (stored.email !== GOOGLE_EMAIL || stored.role !== 'viewer') throw new Error(`Cuenta inesperada: ${stored.email} / ${stored.role}`);
    return `entra ${stored.email} con rol ${stored.role}`;
  });

  await browser.close();
  await server.close();
  fs.writeFileSync(path.join(__dirname, 'login-robusto_resultados.json'), `${JSON.stringify(results, null, 2)}\n`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`${results.length - failed} de ${results.length} verificaciones pasaron`);
  process.exit(failed ? 1 : 0);
})();
