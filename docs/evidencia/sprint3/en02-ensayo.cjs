// Runs the cross-cutting cases of the EN-02 matrix in a real browser with synthetic data.
// It is an automated rehearsal: it does not replace the person who verifies nor a session with users.
// Run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright && node docs/evidencia/sprint3/en02-ensayo.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const XLSX = require(path.join(REPO, 'node_modules/xlsx'));
const PORT = 5193;
const SETS = path.join(REPO, 'fixtures/pruebas');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'saasguard-en02-'));
const CREDENTIALS = Object.fromEntries(
  [...fs.readFileSync(path.join(REPO, 'docs/usuarios-de-prueba.md'), 'utf8').matchAll(/^\| `([^`]+)` \| `[^`]+` \| `([^`]+)` \|/gm)]
    .map(([, user, password]) => [user, password]));

const results = [];
async function check(id, name, run) {
  const start = Date.now();
  try {
    const detail = await run();
    results.push({ id, name, ok: true, seconds: +((Date.now() - start) / 1000).toFixed(1), detail });
    console.log(`OK   ${id} ${name}: ${detail}`);
  } catch (error) {
    results.push({ id, name, ok: false, seconds: +((Date.now() - start) / 1000).toFixed(1), detail: error.message.split('\n')[0] });
    console.log(`FAIL ${id} ${name}: ${error.message.split('\n')[0]}`);
  }
}
function expect(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ channel: 'chrome' });

  async function signedIn(username = 'admin') {
    const context = await browser.newContext({ locale: 'es-AR', viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    page.consoleTexts = [];
    page.on('console', (message) => page.consoleTexts.push(message.text()));
    await page.goto(`http://localhost:${PORT}/`);
    await page.getByLabel('Email o usuario').fill(username);
    await page.getByLabel('Contraseña', { exact: true }).fill(CREDENTIALS[username]);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByRole('heading', { name: /Conciliación Express/ }).waitFor();
    return page;
  }
  async function upload(page, folder, nomina, licencias) {
    const dir = path.join(SETS, folder);
    await page.getByLabel('Cargar nómina CSV').setInputFiles(path.join(dir, nomina));
    await page.getByLabel('Cargar licencias CSV').setInputFiles(licencias.map((name) => path.join(dir, name)));
  }
  async function cross(page) {
    await page.getByText('Confirmo que esta nómina contiene personal vigente').click();
    await page.getByRole('button', { name: 'Auditar y Cruzar Datos' }).click();
  }
  const summary = (page) => page.getByLabel('Resumen del cruce').innerText();
  async function confirmCase(page, email, provider) {
    await page.getByLabel('Buscar casos').fill(email);
    await page.getByLabel('Filtrar plataforma').selectOption(provider);
    await page.getByRole('button', { name: /Ver ficha/ }).first().click();
    await page.getByPlaceholder('Nombre del responsable').fill('Ensayo EN-02');
    await page.getByRole('button', { name: 'Confirmar y agregar al checklist' }).click();
    await page.getByLabel('Buscar casos').fill('');
    await page.getByLabel('Filtrar plataforma').selectOption('all');
  }

  await check('CT-01', 'Cero candidatos', async () => {
    const page = await signedIn();
    await upload(page, '05_casos_borde/cero_candidatos', 'nomina.csv', ['licencias.csv']);
    await cross(page);
    await page.getByText('No encontramos cuentas fuera de la nómina').waitFor();
    const counts = await summary(page);
    expect(/3[\s\S]*3[\s\S]*0/.test(counts), `Conteos inesperados: ${counts}`);
    const checklist = page.getByRole('button', { name: /Ver checklist de bajas/ });
    expect(await checklist.isDisabled(), 'El checklist debería quedar deshabilitado');
    await page.screenshot({ path: path.join(__dirname, 'S3-CT01_cero_candidatos.png') });
    await page.context().close();
    return '3 coincidencias, 0 candidatas, mensaje claro y checklist deshabilitado';
  });

  await check('CT-02', 'Errores de CSV y recuperación', async () => {
    const page = await signedIn();
    await upload(page, '04_validacion_errores/con_errores', 'nomina.csv', ['licencias.csv']);
    const button = page.getByRole('button', { name: 'Auditar y Cruzar Datos' });
    const blocked = await button.isDisabled();
    const text = await page.locator('body').innerText();
    const rows = ['Fila 3', 'Fila 4'].filter((row) => new RegExp(row, 'i').test(text));
    await page.screenshot({ path: path.join(__dirname, 'S3-CT02_errores_de_csv.png'), fullPage: true });
    expect(blocked, 'El cruce debería quedar bloqueado con errores');
    expect(rows.length === 2, 'No se informan las filas con error');
    await upload(page, '04_validacion_errores/corregidos', 'nomina.csv', ['licencias.csv']);
    await page.getByText(/Fila 9/).first().waitFor({ state: 'detached', timeout: 5000 });
    await cross(page);
    const counts = await summary(page);
    expect(/7[\s\S]*4[\s\S]*3/.test(counts), `Conteos inesperados: ${counts}`);
    await page.context().close();
    return 'cruce bloqueado con filas informadas; al corregir no quedan errores viejos: 7 cuentas, 4 coincidencias, 3 candidatas';
  });

  const borde = await signedIn();
  await upload(borde, '05_casos_borde/homonimo_y_duplicados', 'nomina.csv', ['licencias.csv']);
  await check('CT-03', 'Duplicados', async () => {
    const notes = borde.locator('details.issues').filter({ hasText: '1 avisos' });
    await notes.locator('summary').click();
    const warning = await notes.innerText();
    expect(warning.includes('Duplicado exacto de la fila 4'), `Aviso inesperado: ${warning}`);
    await cross(borde);
    const counts = await summary(borde);
    expect(/5[\s\S]*1[\s\S]*4/.test(counts), `Conteos inesperados: ${counts}`);
    const formula = await borde.locator('.savings-formula').innerText();
    expect(formula.includes('23,00'), `Total inesperado: ${formula}`);
    return 'aviso de duplicado; 5 cuentas únicas, 4 candidatas y USD 23,00: la fila repetida no suma';
  });
  await check('CT-05', 'Homónimo', async () => {
    await borde.getByLabel('Buscar casos').fill('aperez@example.test');
    const row = await borde.locator('tbody').first().innerText();
    expect(row.includes('aperez@example.test'), 'La cuenta homónima no aparece como candidata');
    await borde.getByRole('button', { name: /Ver ficha/ }).first().click();
    const panel = borde.locator('details.alias-check');
    await panel.locator('summary').click();
    const text = await panel.innerText();
    expect(text.includes('ana.perez@example.test'), 'La ficha no muestra a la persona con el mismo nombre');
    expect(text.includes('no confirma'), 'Falta la aclaración sobre identidad');
    await borde.screenshot({ path: path.join(__dirname, 'S3-CT05_homonimo.png') });
    await borde.getByRole('button', { name: 'Cerrar ventana' }).click();
    await borde.getByLabel('Buscar casos').fill('');
    return 'aperez@ sigue como candidata; la ficha muestra a ana.perez@ y aclara que no confirma identidad';
  });
  await check('CT-06', 'Costo desconocido', async () => {
    const formula = await borde.locator('.savings-formula').innerText();
    expect(/1 cuenta/.test(formula), `La fórmula no informa la cuenta sin costo: ${formula}`);
    await borde.getByLabel('Buscar casos').fill('elena.vera@example.test');
    const row = await borde.locator('tbody').first().innerText();
    expect(row.includes('Sin informar'), `La fila no dice Sin informar: ${row}`);
    await borde.getByLabel('Buscar casos').fill('');
    return `la fila dice «Sin informar» y la fórmula aclara que no suma: ${formula}`;
  });
  await check('CT-07', 'Exportación de la selección', async () => {
    await confirmCase(borde, 'aperez@example.test', 'Slack');
    await confirmCase(borde, 'elena.vera@example.test', 'Slack');
    await borde.getByRole('button', { name: /Ver checklist de bajas/ }).click();
    const [excel] = await Promise.all([borde.waitForEvent('download'), borde.getByRole('button', { name: 'Descargar Excel' }).click()]);
    const excelFile = path.join(TMP, 'checklist.xlsx');
    await excel.saveAs(excelFile);
    const rows = XLSX.utils.sheet_to_json(XLSX.readFile(excelFile).Sheets.Checklist);
    expect(rows.length === 2, `El Excel tiene ${rows.length} filas`);
    const content = JSON.stringify(rows);
    expect(content.includes('Sin informar'), 'El Excel no conserva «Sin informar»');
    expect(!content.includes('dario.sosa'), 'El Excel incluye una cuenta no seleccionada');
    const [pdf] = await Promise.all([borde.waitForEvent('download'), borde.getByRole('button', { name: 'Descargar PDF' }).click()]);
    const pdfFile = path.join(TMP, 'checklist.pdf');
    await pdf.saveAs(pdfFile);
    expect(fs.readFileSync(pdfFile).subarray(0, 4).toString() === '%PDF', 'El PDF no es válido');
    return `Excel con las 2 cuentas seleccionadas y «Sin informar»; PDF generado (${fs.statSync(pdfFile).size} bytes)`;
  });
  await borde.context().close();

  await check('CT-04', 'Correo normalizado', async () => {
    const page = await signedIn();
    await upload(page, '02_mediano_multiplataforma', 'nomina.csv', ['licencias_google.csv', 'licencias_slack_jira.csv']);
    await cross(page);
    const counts = await summary(page);
    expect(/90[\s\S]*60[\s\S]*30/.test(counts), `Conteos inesperados: ${counts}`);
    await page.context().close();
    return 'los emails con mayúsculas y espacios no generan falsas candidatas: 90 cuentas, 60 coincidencias, 30 candidatas';
  });

  await check('CT-08', 'Ensayo de tiempo de HU-07', async () => {
    const page = await signedIn();
    await upload(page, '03_grande_limite', 'nomina.csv', ['licencias_google.csv', 'licencias_slack.csv', 'licencias_jira.csv', 'licencias_zoom.csv']);
    await page.getByText('Confirmo que esta nómina contiene personal vigente').click();
    const start = Date.now();
    await page.getByRole('button', { name: 'Auditar y Cruzar Datos' }).click();
    await page.getByRole('heading', { name: 'Casos detectados' }).waitFor();
    const ms = Date.now() - start;
    const counts = await summary(page);
    expect(/1\.?000[\s\S]*800[\s\S]*200/.test(counts), `Conteos inesperados: ${counts}`);
    expect(ms < 60000, `Tardó ${ms} ms`);
    await page.context().close();
    return `250 personas y 1.000 licencias: ${ms} ms desde el clic hasta el resultado (objetivo: menos de 60 segundos)`;
  });

  await check('CT-09', 'Eliminación de datos de HU-15', async () => {
    const page = await signedIn();
    await upload(page, '01_simple', 'nomina.csv', ['licencias_google.csv']);
    await cross(page);
    await page.getByRole('heading', { name: 'Casos detectados' }).waitFor();
    await page.getByRole('button', { name: /Cerrar auditoría/ }).first().click();
    const erase = page.getByRole('button', { name: 'Cerrar y borrar datos' });
    expect(await erase.isDisabled(), 'Borrar debería pedir confirmar las descargas');
    await page.getByText('Ya descargué los reportes que necesito').click();
    await erase.click();
    await page.waitForTimeout(300);
    const body = await page.locator('body').innerText();
    expect(!body.includes('fiona@example.test'), 'Quedan datos visibles al cerrar');
    const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
    expect(!stored.includes('example.test'), 'Hay datos de la nómina en el almacenamiento del navegador');
    expect(!page.consoleTexts.join(' ').includes('example.test'), 'Hay datos de la nómina en la consola');
    await page.reload();
    const reloaded = await page.locator('body').innerText();
    expect(!reloaded.includes('fiona@example.test'), 'Quedan datos después de recargar');
    const other = await signedIn('ignacio.it');
    const otherBody = await other.locator('body').innerText();
    expect(!otherBody.includes('fiona@example.test'), 'Otra sesión ve los datos');
    await other.context().close();
    await page.context().close();
    return 'pide confirmar descargas; sin datos en pantalla, almacenamiento, consola, recarga ni en otra sesión';
  });

  await browser.close();
  await server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  results.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(__dirname, 'en02-ensayo_resultados.json'), `${JSON.stringify(results, null, 2)}\n`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`${results.length - failed} de ${results.length} casos pasaron`);
  process.exit(failed ? 1 : 0);
})();
