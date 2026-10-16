/** Synthetic SaaSGuard manual-test fixtures. No production data, network, or randomness. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'fixtures', 'pruebas')
const dependencies = process.env.CODEX_WORKSPACE_NODE_MODULES || path.join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { Workbook } = await import(pathToFileURL(path.join(dependencies, '@oai', 'artifact-tool', 'dist', 'artifact_tool.mjs')).href)
const workbook = Workbook.create()
const documents = []
const employeesHeader = ['email', 'nombre', 'departamento', 'estado']
const licensesHeader = ['email', 'nombre', 'proveedor', 'plan', 'costo_mensual']
const email = (prefix, number) => `${prefix}${String(number).padStart(3, '0')}@example.test`
const person = number => `Persona ficticia ${String(number).padStart(3, '0')}`
const csvCell = value => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function add(relativePath, headers, rows) {
  const sheet = workbook.worksheets.add(`CSV${documents.length + 1}`)
  const matrix = [headers, ...rows]
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.font = { bold: true }
  sheet.getUsedRange().format.autofitColumns()
  documents.push({ relativePath, sheet, rows: rows.length, columns: headers.length })
}

// 1. Small valid audit, with all costs known.
const smallNames = ['Ana Ficticia', 'Bruno Ficticio', 'Carla Ficticia', 'Diego Ficticio', 'Eva Ficticia', 'Fiona Ficticia', 'Galo Ficticio', 'Hana Ficticia']
const smallEmails = ['ana', 'bruno', 'carla', 'diego', 'eva', 'fiona', 'galo', 'hana'].map(name => `${name}@example.test`)
add('01_simple/nomina.csv', employeesHeader, smallNames.slice(0, 5).map((name, i) => [smallEmails[i], name, 'Equipo de prueba', 'Vigente']))
add('01_simple/licencias_google.csv', licensesHeader, smallNames.map((name, i) => [smallEmails[i], name, 'Google Workspace', 'Prueba', i < 5 ? 12 : [12, 8.5, 4][i - 5]]))

// 2. Normalization and distinct unknown/zero monthly costs across three providers.
add('02_mediano_multiplataforma/nomina.csv', employeesHeader, Array.from({ length: 30 }, (_, i) => {
  const value = email('persona', i + 1)
  return [i % 3 === 0 ? `  ${value.toUpperCase()}  ` : value, person(i + 1), ['Sistemas', 'Ventas', 'Administracion'][i % 3], 'Vigente']
}))
const medium = ['Google Workspace', 'Slack', 'Jira'].map((provider, p) => Array.from({ length: 30 }, (_, i) => {
  const index = i < 20 ? i + 1 : i + 11
  const value = email('persona', index)
  const cost = i === 20 ? 0 : i === 21 ? null : [12, 8.75, 7.5][p]
  return [i % 5 === 0 ? ` ${value.toUpperCase()} ` : value, person(index), provider, 'Prueba', cost]
}))
add('02_mediano_multiplataforma/licencias_google.csv', licensesHeader, medium[0])
add('02_mediano_multiplataforma/licencias_slack_jira.csv', licensesHeader, medium[1].concat(medium[2]))

// 3. Exactly the documented global limits, with unique provider/email pairs.
add('03_grande_limite/nomina.csv', employeesHeader, Array.from({ length: 250 }, (_, i) => [email('persona', i + 1), person(i + 1), 'Equipo de prueba', 'Vigente']))
for (const [provider, slug, cost] of [['Google Workspace', 'google', 10], ['Slack', 'slack', 5], ['Jira', 'jira', 7.5], ['Zoom', 'zoom', 15]]) {
  add(`03_grande_limite/licencias_${slug}.csv`, licensesHeader, Array.from({ length: 250 }, (_, i) => {
    const index = i < 200 ? i + 1 : i + 51
    return [email('persona', index), person(index), provider, 'Prueba', cost]
  }))
}

// 4. Invalid inputs are deliberately separate from the corrected version.
const validationNames = ['Aria Ficticia', 'Boro Ficticio', 'Ciro Ficticio', 'Dala Ficticia', 'Ena Ficticia', 'Firo Ficticio', 'Gala Ficticia']
const validationEmails = ['aria', 'boro', 'ciro', 'dala', 'ena', 'firo', 'gala'].map(name => `${name}@example.test`)
add('04_validacion_errores/con_errores/nomina.csv', employeesHeader, [
  [validationEmails[0], validationNames[0], 'Sistemas', 'Vigente'],
  ['boro-sin-arroba', validationNames[1], 'Sistemas', 'Vigente'],
  [validationEmails[2], validationNames[2], 'Sistemas', 'Inactivo'],
  [validationEmails[3], validationNames[3], 'Sistemas', 'Vigente'],
  [validationEmails[3], validationNames[3], 'Ventas', 'Vigente'],
])
add('04_validacion_errores/con_errores/licencias.csv', licensesHeader, [
  [validationEmails[0], validationNames[0], 'Slack', 'Prueba', 12],
  [validationEmails[1], validationNames[1], 'Slack', 'Prueba', -5],
  [validationEmails[2], validationNames[2], 'Slack', 'Prueba', 1.234],
  [validationEmails[3], validationNames[3], 'Slack', 'Prueba', 5],
  [validationEmails[4], validationNames[4], 'Slack', 'Prueba', 15.5],
  [validationEmails[4].toUpperCase(), validationNames[4], 'Slack', 'Prueba', 16],
  [validationEmails[5], validationNames[5], 'Slack', 'Prueba', 0],
  ['gala-sin-arroba', validationNames[6], 'Slack', 'Prueba', null],
])
add('04_validacion_errores/corregidos/nomina.csv', employeesHeader, validationNames.slice(0, 4).map((name, i) => [validationEmails[i], name, 'Sistemas', 'Vigente']))
add('04_validacion_errores/corregidos/licencias.csv', licensesHeader, validationNames.map((name, i) => [validationEmails[i], name, 'Slack', 'Prueba', [12, 9, 7, 5, 15.5, 0, null][i]]))

workbook.recalculate()
for (const document of documents) {
  const matrix = document.sheet.getRangeByIndexes(0, 0, document.rows + 1, document.columns).values
  assert.equal(matrix.length, document.rows + 1)
  assert.ok(matrix.every(row => row.length === document.columns))
  const file = path.join(out, document.relativePath)
  await fs.mkdir(path.dirname(file), { recursive: true })
  // CSV is the requested app-input format. The public Artifact Tool API has no CSV exporter.
  await fs.writeFile(file, '\uFEFF' + matrix.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n', 'utf8')
}

const guides = {
  '01_simple': `PRUEBA SIMPLE\n\nTodos los datos son ficticios. Los emails usan example.test.\n1. Cargar nomina.csv como nomina vigente.\n2. Cargar licencias_google.csv como licencias.\n3. Dejar el costo por defecto vacio y confirmar que la nomina contiene personal vigente.\n4. Ejecutar el cruce.\n\nResultado esperado: 5 personas, 8 licencias unicas, 5 coincidencias y 3 cuentas candidatas a revision.\nPotencial mensual conocido: USD 24,50. Costos desconocidos: 0.\nCandidatas: fiona@example.test (12), galo@example.test (8,50), hana@example.test (4).\nAl comenzar no hay cuentas confirmadas para el checklist. Revisar una ficha, asignar un responsable y confirmar su inclusion para probar la exportacion.\nUna candidata no demuestra una baja: requiere revision humana. La app no cancela cuentas.\n`,
  '02_mediano_multiplataforma': `PRUEBA MEDIANA CON TRES PLATAFORMAS\n\nTodos los datos son ficticios.\n1. Cargar nomina.csv como nomina vigente.\n2. Seleccionar JUNTOS licencias_google.csv y licencias_slack_jira.csv como licencias.\n3. Dejar el costo por defecto vacio. El proveedor se toma de cada fila. Confirmar nomina vigente y ejecutar.\n\nResultado esperado: 30 personas, 90 licencias unicas, 60 coincidencias y 30 candidatas.\nGoogle Workspace, Slack y Jira: 30 licencias y 10 candidatas por proveedor.\nLas candidatas son persona031@example.test a persona040@example.test en cada proveedor.\nHay 3 candidatas con costo cero (persona031 por proveedor) y 3 con costo desconocido (persona032 por proveedor). Cero es un valor conocido; una celda vacia no significa cero.\nPotencial mensual conocido: USD 226,00. Candidatas con costo conocido: 27.\nLos espacios exteriores y las mayusculas de algunos emails deben normalizarse y no generar falsas candidatas.\nAl iniciar: checklist vacio. Se puede filtrar por proveedor y revisar fichas.\nUna candidata requiere revision; no demuestra una baja ni ahorro realizado.\n`,
  '03_grande_limite': `PRUEBA GRANDE EN EL LIMITE ADMITIDO\n\nTodos los datos son ficticios.\n1. Cargar nomina.csv como nomina vigente (250 personas).\n2. Seleccionar JUNTOS los CUATRO CSV de licencias: google, slack, jira y zoom.\n3. Dejar el costo por defecto vacio, confirmar nomina vigente y ejecutar.\n\nResultado esperado: 1.000 licencias unicas, 800 coincidencias y 200 candidatas.\nCada proveedor aporta 250 licencias: 200 coincidentes y 50 candidatas.\nCandidatas: persona251@example.test a persona300@example.test por proveedor.\nPotencial mensual conocido: USD 1.875,00. Costos desconocidos: 0.\nDesglose: Google Workspace USD 500; Slack USD 250; Jira USD 375; Zoom USD 750.\nLos limites son globales: 250 filas de nomina y 1.000 filas de licencias entre TODOS los archivos. No hay duplicados ni conflictos.\nLas personas 201 a 250 estan en la nomina y no tienen licencias en este juego; eso no agrega candidatas.\nAl iniciar: checklist vacio. Confirmar fichas para probar exportaciones.\nUna candidata requiere revision humana; la app no cancela cuentas ni verifica bajas.\n`,
  '04_validacion_errores': `PRUEBA DE ERRORES Y RECUPERACION\n\nTodos los datos son ficticios. Usar UN par de archivos por vez. No cargar las versiones con errores y corregidas juntas.\n\nA. ARCHIVOS CON ERRORES\nCargar con_errores/nomina.csv y con_errores/licencias.csv. Dejar el costo por defecto vacio.\nLa app debe impedir el cruce.\nNomina: 5 filas, 4 observaciones de error. Fila 3: email invalido. Fila 4: estado Inactivo. Filas 5 y 6: mismo email con departamentos contradictorios.\nLicencias: 8 filas, 5 observaciones de error. Fila 3: costo negativo. Fila 4: costo con tres decimales. Filas 6 y 7: misma cuenta de Slack con costos contradictorios. Fila 9: email invalido.\nLos numeros de fila incluyen el encabezado. Una observacion por cada fila contradictoria es esperada.\nNo hay resultado de conciliacion valido para estos archivos.\n\nB. ARCHIVOS CORREGIDOS\nReemplazar AMBOS archivos por corregidos/nomina.csv y corregidos/licencias.csv. Confirmar nomina vigente y ejecutar.\nResultado esperado: 4 personas, 7 licencias unicas, 4 coincidencias y 3 candidatas.\nCandidatas: ena@example.test (USD 15,50), firo@example.test (USD 0), gala@example.test (costo desconocido).\nPotencial mensual conocido: USD 15,50. Candidatas con costo conocido: 2. Costos desconocidos: 1.\nUna celda vacia es costo no informado. Cero es costo conocido. Al iniciar: checklist vacio.\nUna candidata requiere revision y no demuestra una baja. La app no cancela cuentas.\n`,
}
for (const [folder, guide] of Object.entries(guides)) await fs.writeFile(path.join(out, folder, 'GUIA.txt'), guide, 'utf8')
await fs.writeFile(path.join(out, 'LEEME.txt'), `PRUEBAS SAASGUARD\n\nCuatro juegos independientes de datos sinteticos para https://saasguard-express.vercel.app/\nNo mezclar las nominas ni las licencias de juegos diferentes.\n\n01_simple: 5 personas, 8 licencias, 3 candidatas.\n02_mediano_multiplataforma: 30 personas, 90 licencias, 30 candidatas.\n03_grande_limite: 250 personas, 1.000 licencias, 200 candidatas.\n04_validacion_errores: primero observar bloqueos y luego reemplazar por el par corregido (4 personas, 7 licencias, 3 candidatas).\n\nCada carpeta incluye GUIA.txt con instrucciones y resultados exactos.\nTodos los nombres son ficticios y todos los emails validos usan example.test. No hay datos de usuarios, contrasenas, sueldos ni archivos reales. Los costos se expresan en USD mensuales por cuenta.\nEl responsable de revisar debe confirmar las candidatas: no equivalen a bajas comprobadas ni a ahorro realizado. Los archivos que descargues permanecen en tu equipo hasta que los borres.\n`, 'utf8')
// Verify the saved CSVs with the app's actual parser, validators and reconciliation engine.
// Node 24's native TypeScript support loads the source without a second implementation.
const tsHook = registerHooks({
  resolve(specifier, context, nextResolve) {
    // The app uses bundler-style extensionless relative TypeScript imports.
    return nextResolve(specifier.startsWith('.') && !path.extname(specifier) ? `${specifier}.ts` : specifier, context)
  },
})
const domain = await import(pathToFileURL(path.join(root, 'src', 'domain.ts')).href)
tsHook.deregister()
const expectedResults = {
  schemaVersion: 1,
  description: 'Datos completamente sinteticos. Costos en USD mensuales por cuenta. Candidatas requieren revision humana.',
  loading: { employeeEmailColumn: 'email', licenseEmailColumn: 'email', defaultCost: null, confirmCurrentRoster: true },
  cases: [
    { folder: '01_simple', employees: 'nomina.csv', licenses: ['licencias_google.csv'], expected: { employeeCount: 5, totalLicenses: 8, matchedCount: 5, candidateCount: 3, knownCostCount: 3, unknownCostCount: 0, zeroCostCandidateCount: 0, potentialSavingsCents: 2450, selectedCount: 0 } },
    { folder: '02_mediano_multiplataforma', employees: 'nomina.csv', licenses: ['licencias_google.csv', 'licencias_slack_jira.csv'], expected: { employeeCount: 30, totalLicenses: 90, matchedCount: 60, candidateCount: 30, knownCostCount: 27, unknownCostCount: 3, zeroCostCandidateCount: 3, potentialSavingsCents: 22600, selectedCount: 0 } },
    { folder: '03_grande_limite', employees: 'nomina.csv', licenses: ['licencias_google.csv', 'licencias_slack.csv', 'licencias_jira.csv', 'licencias_zoom.csv'], expected: { employeeCount: 250, totalLicenses: 1000, matchedCount: 800, candidateCount: 200, knownCostCount: 200, unknownCostCount: 0, zeroCostCandidateCount: 0, potentialSavingsCents: 187500, selectedCount: 0 } },
    { folder: '04_validacion_errores/corregidos', employees: 'nomina.csv', licenses: ['licencias.csv'], expected: { employeeCount: 4, totalLicenses: 7, matchedCount: 4, candidateCount: 3, knownCostCount: 2, unknownCostCount: 1, zeroCostCandidateCount: 1, potentialSavingsCents: 1550, selectedCount: 0 } },
  ],
  invalidCase: { folder: '04_validacion_errores/con_errores', employees: 'nomina.csv', licenses: ['licencias.csv'], expected: { employeeRows: 5, licenseRows: 8, employeeErrorCount: 4, licenseErrorCount: 5, reconciliationAllowed: false } },
}
async function validateFiles(testCase) {
  const employeeTable = domain.parseCsv(await fs.readFile(path.join(out, testCase.folder, testCase.employees), 'utf8'))
  const employees = domain.validateEmployees(employeeTable, 'email')
  const sources = await Promise.all(testCase.licenses.map(async name => ({ name, emailHeader: 'email', table: domain.parseCsv(await fs.readFile(path.join(out, testCase.folder, name), 'utf8')) })))
  const licenses = domain.validateLicenseFiles(sources, 'Google Workspace', null)
  return { employeeTable, employees, licenses, sources }
}
for (const testCase of expectedResults.cases) {
  const { employees, licenses } = await validateFiles(testCase)
  assert.equal(employees.valid, true, `${testCase.folder}: invalid roster: ${JSON.stringify(employees.issues)}`)
  assert.equal(licenses.valid, true, `${testCase.folder}: invalid licenses: ${JSON.stringify(licenses.issues)}`)
  assert.equal(employees.duplicateCount + licenses.duplicateCount, 0)
  assert.equal(employees.issues.length + licenses.issues.length, 0)
  const candidates = domain.reconcile(licenses.licenses, employees.employees)
  const summary = domain.summarize(candidates, licenses.licenses)
  const actual = { employeeCount: employees.employees.length, totalLicenses: summary.totalLicenses, matchedCount: summary.matchedCount, candidateCount: summary.candidateCount, knownCostCount: summary.knownCostCount, unknownCostCount: summary.unknownCostCount, zeroCostCandidateCount: candidates.filter(candidate => candidate.cost === 0).length, potentialSavingsCents: summary.potentialSavingsCents, selectedCount: summary.selectedCount }
  assert.deepEqual(actual, testCase.expected, testCase.folder)
  // Confirm a manual checklist selection changes totals without performing cancellations.
  const confirmed = domain.summarize(candidates.map(candidate => ({ ...candidate, review: 'confirmed' })), licenses.licenses)
  assert.equal(confirmed.selectedCount, testCase.expected.candidateCount)
  assert.equal(confirmed.selectedSavingsCents, testCase.expected.potentialSavingsCents)
  assert.equal(confirmed.selectedUnknownCostCount, testCase.expected.unknownCostCount)
}
const invalid = await validateFiles(expectedResults.invalidCase)
assert.equal(invalid.employees.valid, false)
assert.equal(invalid.licenses.valid, false)
assert.equal(invalid.employeeTable.rows.length, 5)
assert.equal(invalid.sources[0].table.rows.length, 8)
assert.equal(invalid.employees.issues.filter(issue => issue.severity === 'error').length, 4)
assert.equal(invalid.licenses.issues.filter(issue => issue.severity === 'error').length, 5)
assert.deepEqual(invalid.employees.issues.map(issue => issue.row).sort((a, b) => a - b), [3, 4, 5, 6])
assert.deepEqual(invalid.licenses.issues.map(issue => issue.row).sort((a, b) => a - b), [3, 4, 6, 7, 9])
await fs.writeFile(path.join(out, 'expected-results.json'), JSON.stringify(expectedResults, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ output: out, csvCount: documents.length, verifiedWith: 'src/domain.ts', cases: expectedResults.cases.map(({ folder, expected }) => ({ folder, ...expected })), invalidCase: expectedResults.invalidCase.expected }, null, 2))

// Run with --preview-dir <temporary-directory> for authoring-only sample renders.
const previewIndex = process.argv.indexOf('--preview-dir')
if (previewIndex >= 0) {
  const directory = path.resolve(process.argv[previewIndex + 1])
  await fs.mkdir(directory, { recursive: true })
  for (const document of documents) {
    const preview = await workbook.render({ sheetName: document.sheet.name, range: `A1:${String.fromCharCode(64 + document.columns)}${Math.min(document.rows + 1, 8)}`, scale: 1, format: 'png' })
    await fs.writeFile(path.join(directory, `${document.sheet.name}.png`), new Uint8Array(await preview.arrayBuffer()))
  }
}
