// Browser check of the alias search with synthetic data. Saves the screenshots the PR links to.
// Run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright && node docs/evidencia/sprint3/alias-nombre-completo.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const PORT = 5192;
const SET = path.join(REPO, 'fixtures/pruebas/02_mediano_multiplataforma');
const CREDENTIALS = Object.fromEntries(
  [...fs.readFileSync(path.join(REPO, 'docs/usuarios-de-prueba.md'), 'utf8').matchAll(/^\| `([^`]+)` \| `[^`]+` \| `([^`]+)` \|/gm)]
    .map(([, user, password]) => [user, password]));

const NOMINA = `email,nombre,departamento,estado
ana.perez@example.test,Ana Pérez,Ventas,Vigente
ana.gomez@example.test,Ana Gómez,Ventas,Vigente
ana.ruiz@example.test,Ana Ruiz,Sistemas,Vigente
ana.maria@example.test,Ana María Pérez,Sistemas,Vigente
bruno.diaz@example.test,Bruno Díaz,Finanzas,Vigente
`;
const LICENCIAS = `email,nombre,proveedor,plan,costo_mensual
aperez@example.test,Ana Pérez,Slack,Pro,10
ana@example.test,Ana,Slack,Pro,10
bruno.diaz@example.test,Bruno Díaz,Slack,Pro,10
tomas.vega@example.test,Tomás Vega,Slack,Pro,10
`;
const csv = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });

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

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ channel: 'chrome' });

  async function cross(nomina, licencias) {
    const page = await (await browser.newContext({ locale: 'es-AR', viewport: { width: 1440, height: 1000 } })).newPage();
    await page.goto(`http://localhost:${PORT}/`);
    await page.getByLabel('Email o usuario').fill('florencia.rrhh');
    await page.getByLabel('Contraseña', { exact: true }).fill(CREDENTIALS['florencia.rrhh']);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByLabel('Cargar nómina CSV').setInputFiles(nomina);
    await page.getByLabel('Cargar licencias CSV').setInputFiles(licencias);
    await page.getByText('Confirmo que esta nómina contiene personal vigente').click();
    await page.getByRole('button', { name: 'Auditar y Cruzar Datos' }).click();
    await page.getByRole('heading', { name: 'Casos detectados' }).waitFor();
    return page;
  }
  async function aliasPanel(page, email) {
    await page.getByLabel('Buscar casos').fill(email);
    await page.getByRole('button', { name: /Ver ficha/ }).first().click();
    const panel = page.locator('details.alias-check');
    await panel.locator('summary').click();
    return panel;
  }

  const page = await cross(csv('nomina.csv', NOMINA), csv('licencias.csv', LICENCIAS));
  await check('mismo nombre y apellido con otro email', async () => {
    const panel = await aliasPanel(page, 'aperez@example.test');
    const items = await panel.locator('li').allInnerTexts();
    if (items.length !== 2 || !items[0].includes('ana.perez@example.test') || !items[1].includes('ana.maria@example.test')) throw new Error(`Lista inesperada: ${items.join(' | ')}`);
    await panel.locator('li').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, 'S3-01_alias_coincidencias.png') });
    return items.join(' | ');
  });
  const review = page.locator('details.alias-check');
  await check('la ficha no confirma ni une la cuenta', async () => {
    const text = await review.innerText();
    if (!text.includes('no confirma')) throw new Error('Falta la aclaración');
    return 'sigue la aclaración de que una coincidencia no confirma identidad';
  });

  const second = await cross(csv('nomina.csv', NOMINA), csv('licencias.csv', LICENCIAS));
  await check('cuenta sin apellido', async () => {
    const panel = await aliasPanel(second, 'ana@example.test');
    const text = await panel.innerText();
    if (!text.includes('no informa nombre y apellido') || await panel.locator('li').count()) throw new Error(text);
    return 'avisa que no se puede comparar y no lista a nadie';
  });

  const third = await cross(csv('nomina.csv', NOMINA), csv('licencias.csv', LICENCIAS));
  await check('sin nadie con ese nombre y apellido', async () => {
    const panel = await aliasPanel(third, 'tomas.vega@example.test');
    const text = await panel.innerText();
    if (!text.includes('Ninguna de las 5 personas')) throw new Error(text);
    return 'informa que ninguna de las 5 personas coincide';
  });

  const synthetic = await cross(path.join(SET, 'nomina.csv'), [path.join(SET, 'licencias_google.csv'), path.join(SET, 'licencias_slack_jira.csv')]);
  await check('hallazgo del Sprint 2: nombres que comparten la primera palabra', async () => {
    const panel = await aliasPanel(synthetic, 'persona031@example.test');
    const count = await panel.locator('li').count();
    if (count !== 0) throw new Error(`Lista ${count} personas`);
    await synthetic.screenshot({ path: path.join(__dirname, 'S3-02_alias_sin_coincidencias.png') });
    return 'ya no lista a casi toda la nómina: 0 coincidencias';
  });

  await browser.close();
  await server.close();
  fs.writeFileSync(path.join(__dirname, 'alias-nombre-completo_resultados.json'), `${JSON.stringify(results, null, 2)}\n`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`${results.length - failed} de ${results.length} verificaciones pasaron`);
  process.exit(failed ? 1 : 0);
})();
