// Scripted walkthrough of the three interview profiles (synthetic data, not real users).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP = process.env.APP_URL || 'http://localhost:5181/';
const REPO = '/Users/marcelomansilla/Documents/Uade/saasguard-express';
const SET = path.join(REPO, 'fixtures/pruebas/02_mediano_multiplataforma');
const OUT = path.join(REPO, 'docs/evidencia/sprint2');
const XLSX = require(path.join(REPO, 'node_modules/xlsx'));
fs.mkdirSync(OUT, { recursive: true });

// Test passwords come from the documented synthetic users (docs/usuarios-de-prueba.md).
const CREDENTIALS = Object.fromEntries(
  [...fs.readFileSync(path.join(REPO, 'docs/usuarios-de-prueba.md'), 'utf8').matchAll(/^\| `([^`]+)` \| `[^`]+` \| `([^`]+)` \|/gm)]
    .map(([, user, password]) => [user, password]));

const log = [];
function record(profile, task, ok, ms, detail) {
  log.push({ profile, task, ok, seconds: +(ms / 1000).toFixed(1), detail });
  console.log(`${ok ? 'OK ' : 'FAIL'} [${profile}] ${task} (${(ms / 1000).toFixed(1)} s) ${detail}`);
}
async function step(profile, task, fn) {
  const start = Date.now();
  try { const detail = await fn(); record(profile, task, true, Date.now() - start, detail || ''); }
  catch (e) { record(profile, task, false, Date.now() - start, e.message.split('\n')[0]); }
}
async function shot(page, name, fullPage = true) { await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage }); }

async function signIn(page, username) {
  await page.goto(APP);
  await page.getByLabel('Email o usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(CREDENTIALS[username]);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: /Conciliación Express/ }).waitFor();
}

async function loadAndCross(page, organization, username) {
  await signIn(page, username);
  await page.getByPlaceholder('Nombre para el reporte (opcional)').fill(organization);
  await page.getByLabel('Cargar nómina CSV').setInputFiles(path.join(SET, 'nomina.csv'));
  await page.getByLabel('Cargar licencias CSV').setInputFiles([
    path.join(SET, 'licencias_google.csv'), path.join(SET, 'licencias_slack_jira.csv')]);
  await page.getByText('Confirmo que esta nómina contiene personal vigente').click();
  await page.getByRole('button', { name: 'Auditar y Cruzar Datos' }).click();
  await page.getByRole('heading', { name: 'Casos detectados' }).waitFor();
}
async function openCase(page, email, provider) {
  await page.getByLabel('Buscar casos').fill(email);
  await page.getByLabel('Filtrar plataforma').selectOption(provider);
  await page.getByRole('button', { name: /Ver ficha/ }).first().click();
}
async function confirmCase(page, email, provider, who, cost) {
  await openCase(page, email, provider);
  if (cost !== undefined) await page.getByLabel('Costo del caso').fill(cost);
  await page.getByPlaceholder('Nombre del responsable').fill(who);
  await page.getByRole('button', { name: 'Confirmar y agregar al checklist' }).click();
  await page.getByLabel('Buscar casos').fill('');
  await page.getByLabel('Filtrar plataforma').selectOption('all');
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const newPage = async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'es-AR' });
    return context.newPage();
  };

  // IT · Ignacio
  {
    const page = await newPage();
    const P = 'IT (Ignacio)';
    await step(P, 'T1 Cargar nómina y dos exportaciones y cruzar', async () => {
      const t0 = Date.now();
      await loadAndCross(page, 'Empresa ficticia del ensayo', 'ignacio.it');
      await shot(page, 'S2-01_IT_resultado_y_reglas_de_conteo');
      const rules = await page.getByLabel('Resumen del cruce').innerText();
      if (!/90[\s\S]*60[\s\S]*30/.test(rules)) throw new Error('Conteos inesperados: ' + rules);
      return `90 válidas, 60 coincidencias, 30 candidatas; ${Date.now() - t0} ms desde abrir la app`;
    });
    await step(P, 'T2 Filtrar Slack y buscar persona035', async () => {
      await page.getByLabel('Filtrar plataforma').selectOption('Slack');
      await page.getByLabel('Buscar casos').fill('persona035');
      const caption = await page.locator('.table-caption').innerText();
      await shot(page, 'S2-02_IT_filtro_y_busqueda');
      if (!caption.startsWith('1 de 30')) throw new Error(caption);
      await page.getByLabel('Buscar casos').fill('');
      await page.getByLabel('Filtrar plataforma').selectOption('all');
      return caption.split('·')[0].trim();
    });
    await step(P, 'T3 Confirmar dos casos y descargar Excel', async () => {
      await confirmCase(page, 'persona035', 'Slack', 'Ignacio (IT)');
      await confirmCase(page, 'persona036', 'Jira', 'Ignacio (IT)');
      await page.getByRole('button', { name: /Ver checklist de bajas/ }).click();
      await shot(page, 'S2-03_IT_checklist_con_estado_y_subtotal');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar Excel' }).click()]);
      const file = path.join(OUT, 'S2_IT_checklist.xlsx');
      await download.saveAs(file);
      const wb = XLSX.readFile(file);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets.Checklist);
      return `Excel con ${rows.length} filas; estado «${rows[0]['Estado']}»`;
    });
    await page.context().close();
  }

  // People Operations · Florencia
  {
    const page = await newPage();
    const P = 'People Ops (Florencia)';
    await loadAndCross(page, 'Empresa ficticia del ensayo', 'florencia.rrhh');
    await step(P, 'T1 Dejar un caso para revisar con RRHH con nota', async () => {
      await openCase(page, 'persona033', 'Jira');
      await page.getByText('Verificar posibles alias en la nómina').click();
      await page.getByPlaceholder(/Por ejemplo/).fill('Consultar con RRHH si es la licencia de un reemplazo.');
      await shot(page, 'S2-04_PeopleOps_ficha_y_alias', false);
      await page.getByRole('button', { name: 'Guardar para revisar con RRHH' }).click();
      await page.getByLabel('Buscar casos').fill('persona033');
      const text = await page.locator('tbody').innerText();
      if (!text.includes('Nota: Consultar con RRHH')) throw new Error('No se ve la nota');
      return 'la fila muestra la nota y sigue fuera del checklist';
    });
    await step(P, 'T2 Mantener una cuenta como excepción', async () => {
      await page.getByLabel('Buscar casos').fill('');
      await openCase(page, 'persona034', 'Google Workspace');
      await page.getByPlaceholder('Nombre del responsable').fill('Florencia (People Ops)');
      await page.getByPlaceholder(/Por ejemplo/).fill('Cuenta compartida de la recepción.');
      await page.getByRole('button', { name: 'Mantener cuenta / excepción' }).click();
      await page.getByLabel('Buscar casos').fill('');
      await page.getByLabel('Filtrar plataforma').selectOption('all');
      await page.getByLabel('Filtrar revisión').selectOption('retained');
      const caption = await page.locator('.table-caption').innerText();
      await shot(page, 'S2-05_PeopleOps_excepcion_filtrada');
      await page.getByLabel('Filtrar revisión').selectOption('all');
      return caption.split('·')[0].trim() + ' con estado «Mantener cuenta»';
    });
    await step(P, 'T3 Cerrar la auditoría y eliminar los datos', async () => {
      await page.getByRole('button', { name: /Cerrar auditoría/ }).first().click();
      const del = page.getByRole('button', { name: 'Cerrar y borrar datos' });
      const disabledBefore = await del.isDisabled();
      await shot(page, 'S2-06_PeopleOps_confirmar_descargas_antes_de_borrar', false);
      await page.getByText('Ya descargué los reportes que necesito').click();
      await del.click();
      await page.waitForTimeout(300);
      await shot(page, 'S2-07_PeopleOps_auditoria_cerrada');
      const body = await page.locator('body').innerText();
      if (body.includes('persona033')) throw new Error('Quedan datos visibles');
      return `botón bloqueado hasta confirmar descargas: ${disabledBefore ? 'sí' : 'no'}; sin datos visibles al cerrar`;
    });
    await page.context().close();
  }

  // Finanzas · Gonzalo
  {
    const page = await newPage();
    const P = 'Finanzas (Gonzalo)';
    await loadAndCross(page, 'Empresa ficticia del ensayo', 'gonzalo.finanzas');
    await step(P, 'T1 Completar un costo sin informar', async () => {
      const before = await page.locator('.savings-formula').innerText();
      await confirmCase(page, 'persona032', 'Google Workspace', 'Gonzalo (Finanzas)', '15');
      await page.getByLabel('Buscar casos').fill('persona032');
      await page.getByLabel('Filtrar plataforma').selectOption('Google Workspace');
      const row = await page.locator('tbody').innerText();
      await shot(page, 'S2-08_Finanzas_costo_informado_por_usuario');
      if (!row.includes('Informado por el usuario')) throw new Error('Sin marca de origen');
      await page.getByLabel('Buscar casos').fill('');
      await page.getByLabel('Filtrar plataforma').selectOption('all');
      return `antes: ${before.split('.')[0]}`;
    });
    await step(P, 'T2 Leer el ahorro potencial y su fórmula', async () => {
      const formula = await page.locator('.savings-formula').innerText();
      await shot(page, 'S2-09_Finanzas_formula_del_ahorro');
      if (!formula.includes('241,00')) throw new Error(formula);
      return formula;
    });
    await step(P, 'T3 Descargar el PDF del checklist', async () => {
      await confirmCase(page, 'persona033', 'Slack', 'Gonzalo (Finanzas)');
      await confirmCase(page, 'persona038', 'Jira', 'Gonzalo (Finanzas)');
      await page.getByRole('button', { name: /Ver checklist de bajas/ }).click();
      await shot(page, 'S2-10_Finanzas_checklist_subtotal_vs_total');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar PDF' }).click()]);
      const file = path.join(OUT, 'S2_Finanzas_checklist.pdf');
      await download.saveAs(file);
      const pdf = fs.readFileSync(file, 'latin1');
      return `PDF de ${fs.statSync(file).size} bytes; incluye la aclaración de ahorro potencial: ${pdf.includes('potencial') ? 'sí' : 'no'}`;
    });
    await page.context().close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'simulacion_resultados.json'), JSON.stringify(log, null, 2));
})();
