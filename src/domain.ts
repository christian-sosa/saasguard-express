import Papa from 'papaparse'

/** Pure domain functions. No persistence, network calls, or personnel-data logging. */
export interface Issue {
  /** Starting physical line in the CSV; 0 is file-wide. */
  row: number
  message: string
  severity: 'error' | 'warning'
  file?: string
}

export interface CsvTable {
  headers: string[]
  rows: Record<string, string>[]
  issues?: Issue[]
  rowNumbers?: number[]
  headerRow?: number
}

export interface ParseResult extends CsvTable { issues: Issue[] }

export interface Employee {
  email: string
  name: string
  department?: string
  status?: string
  originalEmail?: string
}

export interface License {
  id: string
  email: string
  name: string
  provider: string
  plan: string
  /** Monthly USD per account, not annual prices or a package price. null = unknown. */
  cost: number | null
  status?: string
  originalEmail?: string
  costSource?: 'csv' | 'default' | 'unknown'
}

export interface Candidate extends License {
  /** confirmed = explicitly selected for a manual review checklist, never a completed cancellation. */
  review: 'pending' | 'confirmed' | 'retained'
  note?: string
  assignee?: string
}

export interface ValidationResult<T> {
  items: T[]
  issues: Issue[]
  valid: boolean
  duplicateCount: number
}

export interface EmployeeValidation extends ValidationResult<Employee> { employees: Employee[] }
export interface LicenseValidation extends ValidationResult<License> { licenses: License[] }

export interface Summary {
  totalLicenses: number
  matchedCount: number
  candidateCount: number
  knownCostCount: number
  unknownCostCount: number
  potentialSavings: number
  potentialSavingsCents: number
  selectedCount: number
  selectedSavings: number
  selectedSavingsCents: number
  selectedUnknownCostCount: number
}

export const MAX_EMPLOYEES = 250
export const MAX_LICENSES = 1000
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const SNAPSHOT_VERSION = 1 as const
export const SNAPSHOT_TYPE = 'saasguard-complete-candidates' as const

export interface Snapshot {
  type: typeof SNAPSHOT_TYPE
  version: typeof SNAPSHOT_VERSION
  complete: true
  provider: string
  createdAt: string
  allLicenseCount: number
  candidateCount: number
  candidates: Candidate[]
}

export interface SnapshotComparison {
  previous: Snapshot
  next: Snapshot
  new: Candidate[]
  persistent: Candidate[]
  noLongerPresent: Candidate[]
  costChanges: { id: string; email: string; previousCost: number | null; nextCost: number | null }[]
}

const error = (row: number, message: string): Issue => ({ row, message, severity: 'error' })
const warning = (row: number, message: string): Issue => ({ row, message, severity: 'warning' })
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()
const normalizeProvider = (provider: string): string => provider.trim().toLowerCase()
export const licenseId = (provider: string, email: string): string =>
  JSON.stringify([normalizeProvider(provider), normalizeEmail(email)])

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value)
  if (email.length > 254 || email.includes('..')) return false
  const local = email.split('@')[0]
  if (local.startsWith('.') || local.endsWith('.')) return false
  // Intentionally conservative, without rewriting dots, plus tags, aliases, or domains.
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)
}

const canonicalHeader = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const findHeader = (table: CsvTable, aliases: string[]): string | undefined => {
  const wanted = new Set(aliases.map(canonicalHeader))
  return table.headers.find(header => wanted.has(canonicalHeader(header)))
}
/** Google marks its CSV headers with tags such as «Email Address [Required]»; for the email suggestion the tag is not part of the name. */
const untaggedHeader = (value: string): string => canonicalHeader(value.replace(/\[[^\]]*\]/g, ''))

export function suggestEmailHeader(headers: string[]): string {
  const aliases = ['email', 'correo', 'correo electrónico', 'email address', 'mail', 'user principal name', 'primary email', 'correo corporativo']
  const untagged = new Set(aliases.map(untaggedHeader))
  return findHeader({ headers, rows: [] }, aliases) ?? headers.find(header => untagged.has(untaggedHeader(header))) ?? ''
}

const exactEmailName = /^(email|e-mail|correo|correo_electronico|mail)$/i
/** Column preselected as the email column when a file is loaded: an exact email name wins over the wider aliases, then the first column. */
export function pickEmailHeader(headers: string[]): string {
  return headers.find(header => exactEmailName.test(header.trim())) ?? (suggestEmailHeader(headers) || (headers[0] ?? ''))
}

export function parseCsv(text: string): ParseResult {
  if (!text.trim()) return { headers: [], rows: [], issues: [error(0, 'El archivo está vacío. Volvé a exportar la lista y cargá un CSV con una fila de encabezado y al menos una fila de datos.')], rowNumbers: [] }
  if (text.includes('\0')) return { headers: [], rows: [], issues: [error(0, 'El archivo contiene datos binarios; cargá un CSV de texto.')], rowNumbers: [] }
  const input = text.replace(/^\uFEFF/, '')
  const parsed = Papa.parse<string[]>(input, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
    delimitersToGuess: [',', ';', '\t'],
  })
  const physicalRows = csvPhysicalRows(input, parsed.meta.delimiter || ',')
  const records = parsed.data.map((cells, index) => ({ cells, row: physicalRows[index] ?? index + 1 })).filter(({ cells }) => cells.some(cell => cell.trim() !== ''))
  const issues: Issue[] = parsed.errors.filter(issue => issue.code !== 'UndetectableDelimiter').map(issue =>
    error(typeof issue.row === 'number' ? physicalRows[issue.row] ?? issue.row + 1 : 0, `No se pudo interpretar el CSV: ${issue.message}`))
  const headers = (records[0]?.cells ?? []).map(header => header.trim().replace(/^\uFEFF/, ''))
  const headerRow = records[0]?.row ?? 1
  if (headers.length === 0 || headers.some(header => !header)) issues.push(error(headerRow, 'Todas las columnas necesitan un encabezado.'))
  const seenHeaders = new Set<string>()
  for (const header of headers) {
    const key = canonicalHeader(header)
    if (seenHeaders.has(key)) issues.push(error(headerRow, `El encabezado "${header}" está duplicado o es ambiguo.`))
    seenHeaders.add(key)
  }
  const rows: Record<string, string>[] = []
  const rowNumbers: number[] = []
  records.slice(1).forEach(({ cells, row: rowNumber }) => {
    if (cells.length !== headers.length) {
      issues.push(error(rowNumber, `La fila tiene ${cells.length} columnas; se esperaban ${headers.length}.`))
      return
    }
    const row = Object.create(null) as Record<string, string>
    headers.forEach((header, column) => { row[header] = cells[column] ?? '' })
    rows.push(row)
    rowNumbers.push(rowNumber)
  })
  if (!rows.length) issues.push(error(0, 'El CSV necesita al menos una fila de datos.'))
  return { headers, rows, issues, rowNumbers, headerRow }
}

/** PapaParse handles cell syntax; this scan tracks start lines without losing quoted newlines. */
function csvPhysicalRows(input: string, delimiter: string): number[] {
  const starts = [1]
  let line = 1
  let quoted = false
  let fieldStart = true
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { index += 1; continue }
      if (quoted) quoted = false
      else if (fieldStart) quoted = true
      fieldStart = false
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      line += 1
      if (!quoted) { starts.push(line); fieldStart = true }
    } else if (!quoted && char === delimiter) fieldStart = true
    else fieldStart = false
  }
  return starts
}

function baseValidation(table: CsvTable, emailHeader: string, limit: number): Issue[] {
  const issues = [...(table.issues ?? [])]
  if (!emailHeader || !table.headers.includes(emailHeader)) issues.push(error(table.headerRow ?? 1, 'Asigná una columna existente como email antes de continuar.'))
  if (!table.rows.length && !issues.some(issue => issue.row === 0 && issue.severity === 'error')) issues.push(error(0, 'No hay filas para validar.'))
  if (table.rows.length > limit) issues.push(error(0, `El límite de esta prueba es ${limit.toLocaleString('es-AR')} filas. Reemplazá o recortá el archivo.`))
  return issues
}

function field(row: Record<string, string>, header: string | undefined): string {
  return header ? (row[header] ?? '').trim() : ''
}

const rowAt = (table: CsvTable, index: number): number => table.rowNumbers?.[index] ?? index + 2

function distinctRows<T>(records: { key: string; value: T; row: number; signature: string }[], issues: Issue[]): { items: T[]; duplicateCount: number } {
  const groups = new Map<string, typeof records>()
  for (const record of records) {
    const group = groups.get(record.key)
    if (group) group.push(record)
    else groups.set(record.key, [record])
  }
  let duplicateCount = 0
  const items: T[] = []
  for (const group of groups.values()) {
    if (new Set(group.map(record => record.signature)).size > 1) {
      for (const record of group) issues.push(error(record.row, 'La identidad está repetida con datos contradictorios. Corregí o excluí explícitamente las filas antes de conciliar.'))
      continue
    }
    items.push(group[0].value)
    for (const record of group.slice(1)) {
      duplicateCount += 1
      issues.push(warning(record.row, `Duplicado exacto de la fila ${group[0].row}; se cuenta una sola vez.`))
    }
  }
  return { items, duplicateCount }
}

export function validateEmployees(table: CsvTable, emailHeader: string): EmployeeValidation {
  const issues = baseValidation(table, emailHeader, MAX_EMPLOYEES)
  const nameHeader = findHeader(table, ['nombre', 'name', 'full name', 'display name', 'nombre completo'])
  const departmentHeader = findHeader(table, ['area', 'department', 'departamento'])
  const statusHeader = findHeader(table, ['estado', 'status', 'employment status'])
  const records: { key: string; value: Employee; row: number; signature: string }[] = []
  if (table.headers.includes(emailHeader)) table.rows.forEach((row, index) => {
    const rowNumber = rowAt(table, index)
    const originalEmail = row[emailHeader] ?? ''
    if (!isValidEmail(originalEmail)) { issues.push(error(rowNumber, 'El email está vacío o tiene un formato inválido.')); return }
    const status = field(row, statusHeader)
    if (['inactivo', 'inactive', 'baja', 'terminated', 'desvinculado', 'false', '0'].includes(canonicalHeader(status))) {
      issues.push(error(rowNumber, 'La nómina debe incluir sólo personal vigente; esta fila declara una baja o un estado inactivo.'))
      return
    }
    const value: Employee = {
      email: normalizeEmail(originalEmail), name: field(row, nameHeader), originalEmail,
      ...(departmentHeader ? { department: field(row, departmentHeader) } : {}),
      ...(statusHeader ? { status } : {}),
    }
    records.push({ key: value.email, value, row: rowNumber, signature: JSON.stringify([value.name, value.department ?? '', status]) })
  })
  const { items, duplicateCount } = distinctRows(records, issues)
  return { items, employees: items, issues, valid: !issues.some(issue => issue.severity === 'error'), duplicateCount }
}

export function costToCents(cost: number | null): number | null {
  if (cost === null) return null
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) throw new Error('El costo mensual debe ser un número no negativo en USD.')
  const scaled = cost * 100
  const cents = Math.round(scaled)
  if (!Number.isSafeInteger(cents) || Math.abs(scaled - cents) > 0.000001) throw new Error('El costo mensual necesita como máximo dos decimales.')
  return cents
}

export function parseMonthlyCost(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  if (typeof value === 'number') { costToCents(value); return value }
  const text = value.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Ingresá un costo mensual no negativo en USD, con hasta dos decimales y sin símbolos ni separadores de miles.')
  const normalized = text.replace(',', '.')
  const [units, decimal = ''] = normalized.split('.')
  const cents = Number(units) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('El costo es demasiado grande para calcularlo con precisión.')
  return cents / 100
}

function validateLicenseTable(table: CsvTable, emailHeader: string, defaultProvider: string, defaultCost?: number | null, allowRowProviders = false): LicenseValidation {
  const issues = baseValidation(table, emailHeader, MAX_LICENSES)
  const provider = defaultProvider.trim()
  if (!provider && !allowRowProviders) issues.push(error(0, 'Elegí el proveedor de esta exportación.'))
  try { costToCents(defaultCost ?? null) } catch (exception) { issues.push(error(0, (exception as Error).message)) }
  const nameHeader = findHeader(table, ['nombre', 'name', 'full name', 'display name', 'nombre completo'])
  const providerHeader = findHeader(table, ['provider', 'proveedor', 'plataforma'])
  const planHeader = findHeader(table, ['plan', 'licencia', 'license', 'subscription'])
  const costHeader = findHeader(table, ['cost', 'costo', 'cost usd', 'monthly cost usd', 'costo mensual usd', 'costo mensual', 'costo usd', 'precio mensual usd'])
  const statusHeader = findHeader(table, ['estado', 'status', 'account status'])
  const records: { key: string; value: License; row: number; signature: string }[] = []
  if (table.headers.includes(emailHeader) && (provider || allowRowProviders)) table.rows.forEach((row, index) => {
    const rowNumber = rowAt(table, index)
    const originalEmail = row[emailHeader] ?? ''
    if (!isValidEmail(originalEmail)) { issues.push(error(rowNumber, 'El email está vacío o tiene un formato inválido.')); return }
    const rowProvider = field(row, providerHeader)
    if (!allowRowProviders && rowProvider && normalizeProvider(rowProvider) !== normalizeProvider(provider)) {
      issues.push(error(rowNumber, 'El proveedor de la fila no coincide con el proveedor elegido para esta exportación.'))
      return
    }
    const selectedProvider = allowRowProviders ? rowProvider || provider : provider
    if (!selectedProvider) { issues.push(error(rowNumber, 'La fila necesita un proveedor o un proveedor predeterminado.')); return }
    const rawCost = field(row, costHeader)
    let cost: number | null
    try { cost = parseMonthlyCost(rawCost || defaultCost) } catch (exception) { issues.push(error(rowNumber, (exception as Error).message)); return }
    const value: License = {
      id: licenseId(selectedProvider, originalEmail), email: normalizeEmail(originalEmail), originalEmail,
      name: field(row, nameHeader), provider: selectedProvider, plan: field(row, planHeader), cost,
      costSource: rawCost ? 'csv' : cost !== null ? 'default' : 'unknown',
      ...(statusHeader ? { status: field(row, statusHeader) } : {}),
    }
    records.push({ key: value.id, value, row: rowNumber, signature: JSON.stringify([value.name, value.plan, value.cost, value.status ?? '']) })
  })
  const { items, duplicateCount } = distinctRows(records, issues)
  return { items, licenses: items, issues, valid: !issues.some(issue => issue.severity === 'error'), duplicateCount }
}

/** The single-source MVP deliberately checks any provider column against the chosen provider. */
export function validateLicenses(table: CsvTable, emailHeader: string, defaultProvider: string, defaultCost?: number | null): LicenseValidation {
  return validateLicenseTable(table, emailHeader, defaultProvider, defaultCost)
}

export interface LicenseFileInput { name: string; table: CsvTable; emailHeader: string }

/** Consolidates files after resolving their own aliases; neither per-file limits nor duplicate counts reset. */
export function validateLicenseFiles(inputs: LicenseFileInput[], defaultProvider: string, defaultCost?: number | null): LicenseValidation {
  const sourceIssues: Issue[] = []
  const sources = new Map<number, { file: string; row: number }>()
  const rows: Record<string, string>[] = []
  const totalRows = inputs.reduce((sum, input) => sum + input.table.rows.length, 0)
  const tag = (issue: Issue, file: string, row = issue.row): Issue => ({ ...issue, file, row,
    message: `${file}${row ? `, fila ${row}` : ''}: ${issue.message}` })
  if (!inputs.length) sourceIssues.push(error(0, 'Cargá al menos un archivo de licencias.'))
  if (totalRows > MAX_LICENSES) sourceIssues.push(error(0, `Los archivos suman ${totalRows.toLocaleString('es-AR')} filas. El límite global es ${MAX_LICENSES.toLocaleString('es-AR')}; no se reinicia por archivo.`))
  for (const input of inputs) {
    const file = input.name.trim() || 'Archivo sin nombre'
    sourceIssues.push(...(input.table.issues ?? []).map(issue => tag(issue, file)))
    if (!input.table.rows.length) sourceIssues.push(tag(error(0, 'El archivo necesita al menos una fila de datos.'), file))
    if (!input.emailHeader || !input.table.headers.includes(input.emailHeader)) {
      sourceIssues.push(tag(error(input.table.headerRow ?? 1, 'Asigná una columna existente como email para este archivo.'), file))
      continue
    }
    const nameHeader = findHeader(input.table, ['nombre', 'name', 'full name', 'display name', 'nombre completo'])
    const providerHeader = findHeader(input.table, ['provider', 'proveedor', 'plataforma'])
    const planHeader = findHeader(input.table, ['plan', 'licencia', 'license', 'subscription'])
    const costHeader = findHeader(input.table, ['cost', 'costo', 'cost usd', 'monthly cost usd', 'costo mensual usd', 'costo mensual', 'costo usd', 'precio mensual usd'])
    const statusHeader = findHeader(input.table, ['estado', 'status', 'account status'])
    input.table.rows.forEach((row, index) => {
      const number = rows.length + 2
      sources.set(number, { file, row: rowAt(input.table, index) })
      rows.push({ email: row[input.emailHeader] ?? '', name: field(row, nameHeader), provider: field(row, providerHeader),
        plan: field(row, planHeader), cost: field(row, costHeader), status: field(row, statusHeader) })
    })
  }
  const merged = validateLicenseTable({ headers: ['email', 'name', 'provider', 'plan', 'cost', 'status'], rows }, 'email', defaultProvider, defaultCost, true)
  const issues = [...sourceIssues, ...merged.issues.map(issue => {
    const source = sources.get(issue.row)
    if (!source) return issue
    const message = issue.message.replace(/fila (\d+)/g, (_match, row: string) => {
      const referenced = sources.get(Number(row))
      return referenced ? `fila ${referenced.row} de ${referenced.file}` : `fila ${row}`
    })
    return tag({ ...issue, message }, source.file, source.row)
  })]
  return { ...merged, issues, valid: !issues.some(issue => issue.severity === 'error') }
}

function cleanLicense(value: License): License {
  if (!value || typeof value.email !== 'string' || !isValidEmail(value.email) || typeof value.provider !== 'string' || !value.provider.trim()) throw new Error('La licencia necesita proveedor y email válidos.')
  if (typeof value.name !== 'string' || typeof value.plan !== 'string') throw new Error('La licencia necesita nombre y plan como texto, aunque estén vacíos.')
  costToCents(value.cost)
  return { ...value, id: licenseId(value.provider, value.email), email: normalizeEmail(value.email), provider: value.provider.trim() }
}

function uniqueLicenses(licenses: License[]): License[] {
  const unique = new Map<string, License>()
  for (const source of licenses) {
    const value = cleanLicense(source)
    const old = unique.get(value.id)
    if (old && JSON.stringify([old.name, old.plan, old.cost, old.status ?? '']) !== JSON.stringify([value.name, value.plan, value.cost, value.status ?? ''])) throw new Error('Hay licencias con la misma identidad y datos contradictorios.')
    if (!old) unique.set(value.id, value)
  }
  return [...unique.values()]
}

function cleanCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>()
  return candidates.map(candidate => {
    const value = cleanLicense(candidate)
    if (!['pending', 'confirmed', 'retained'].includes(candidate.review)) throw new Error('El estado de revisión de la cuenta es inválido.')
    if (seen.has(value.id)) throw new Error('Hay candidatos repetidos; no se puede sumar ni comparar dos veces la misma cuenta.')
    seen.add(value.id)
    return { ...value, review: candidate.review, ...(candidate.note !== undefined ? { note: candidate.note } : {}), ...(candidate.assignee !== undefined ? { assignee: candidate.assignee } : {}) }
  })
}

export function reconcile(licenses: License[], employees: Employee[]): Candidate[] {
  const roster = new Set<string>()
  for (const person of employees) {
    if (!person || typeof person.email !== 'string' || !isValidEmail(person.email)) throw new Error('La nómina contiene un email inválido; corregila antes de conciliar.')
    roster.add(normalizeEmail(person.email))
  }
  return uniqueLicenses(licenses).filter(license => !roster.has(license.email)).map(license => ({ ...license, review: 'pending' }))
}

function sumCents(candidates: Candidate[]): number {
  let sum = 0
  for (const candidate of candidates) {
    sum += costToCents(candidate.cost) ?? 0
    if (!Number.isSafeInteger(sum)) throw new Error('El total supera el rango de cálculo preciso.')
  }
  return sum
}

export function summarize(candidates: Candidate[], licenses: License[]): Summary {
  const all = uniqueLicenses(licenses)
  const values = cleanCandidates(candidates)
  const ids = new Set(all.map(license => license.id))
  if (values.some(candidate => !ids.has(candidate.id))) throw new Error('La lista contiene una cuenta que no pertenece a la auditoría.')
  const selected = values.filter(candidate => candidate.review === 'confirmed')
  const potentialSavingsCents = sumCents(values)
  const selectedSavingsCents = sumCents(selected)
  const unknownCostCount = values.filter(candidate => candidate.cost === null).length
  return {
    totalLicenses: all.length, matchedCount: all.length - values.length, candidateCount: values.length,
    knownCostCount: values.length - unknownCostCount, unknownCostCount,
    potentialSavings: potentialSavingsCents / 100, potentialSavingsCents,
    selectedCount: selected.length, selectedSavings: selectedSavingsCents / 100, selectedSavingsCents,
    selectedUnknownCostCount: selected.filter(candidate => candidate.cost === null).length,
  }
}

export function filterCandidates(candidates: Candidate[], query = '', review: Candidate['review'] | 'all' = 'all', provider = ''): Candidate[] {
  const search = query.trim().toLocaleLowerCase('es')
  return candidates.filter(candidate => (review === 'all' || candidate.review === review)
    && (!provider || normalizeProvider(candidate.provider) === normalizeProvider(provider))
    && (!search || [candidate.email, candidate.name, candidate.provider].some(value => value.toLocaleLowerCase('es').includes(search))))
}

type Timestamp = string | number | Date

function epoch(value: Timestamp): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value !== 'string') return Number.NaN
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return Number.NaN
  // Avoid JavaScript accepting impossible dates such as February 31 or numeric strings.
  return new Date(parsed).toISOString() === value ? parsed : Number.NaN
}

export function isExpired(createdAt: Timestamp, now: Timestamp = Date.now()): boolean {
  const created = epoch(createdAt)
  const current = epoch(now)
  return !Number.isFinite(created) || !Number.isFinite(current) || created > current || current - created >= SESSION_MAX_AGE_MS
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

export function validateSnapshot(input: unknown): Snapshot {
  if (!record(input) || input.type !== SNAPSHOT_TYPE || input.version !== SNAPSHOT_VERSION || input.complete !== true) throw new Error('Necesitás un snapshot completo SaaSGuard v1; un checklist parcial no sirve para comparar períodos.')
  const allowed = ['type', 'version', 'complete', 'provider', 'createdAt', 'allLicenseCount', 'candidateCount', 'candidates']
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('El snapshot contiene campos que no pertenecen al formato completo de comparación.')
  if (typeof input.provider !== 'string' || !input.provider.trim() || typeof input.createdAt !== 'string' || !Number.isFinite(epoch(input.createdAt))) throw new Error('El proveedor o la fecha ISO UTC del snapshot son inválidos.')
  if (!Number.isSafeInteger(input.allLicenseCount) || !Number.isSafeInteger(input.candidateCount)
    || (input.allLicenseCount as number) < 0 || (input.candidateCount as number) < 0
    || (input.candidateCount as number) > (input.allLicenseCount as number)
    || !Array.isArray(input.candidates) || input.candidateCount !== input.candidates.length) throw new Error('Los conteos del snapshot no coinciden con su universo completo de candidatos.')
  const candidates: Candidate[] = input.candidates.map(value => {
    if (!record(value) || typeof value.id !== 'string' || typeof value.email !== 'string' || typeof value.name !== 'string' || typeof value.provider !== 'string' || typeof value.plan !== 'string'
      || !(value.cost === null || typeof value.cost === 'number') || !['pending', 'confirmed', 'retained'].includes(String(value.review))) throw new Error('El snapshot contiene una cuenta con campos inválidos.')
    const candidateAllowed = ['id', 'email', 'name', 'provider', 'plan', 'cost', 'review', 'status', 'note', 'assignee']
    if (Object.keys(value).some(key => !candidateAllowed.includes(key)) || ['status', 'note', 'assignee'].some(key => value[key] !== undefined && typeof value[key] !== 'string')) throw new Error('La cuenta contiene campos no admitidos por el snapshot.')
    if (normalizeProvider(value.provider) !== normalizeProvider(input.provider as string) || value.email !== normalizeEmail(value.email) || value.id !== licenseId(value.provider, value.email)) throw new Error('La identidad o el proveedor de una cuenta no coincide con el snapshot.')
    return value as unknown as Candidate
  })
  const clean = cleanCandidates(candidates)
  return { type: SNAPSHOT_TYPE, version: SNAPSHOT_VERSION, complete: true, provider: input.provider.trim(), createdAt: input.createdAt,
    allLicenseCount: input.allLicenseCount as number, candidateCount: input.candidateCount as number, candidates: clean }
}

/** The caller must supply the whole candidate set, never filterCandidates() or the checklist selection. */
export function createSnapshot(candidates: Candidate[], provider: string, allLicenseCount: number, createdAt: Timestamp = new Date()): Snapshot {
  const time = epoch(createdAt)
  if (!Number.isFinite(time)) throw new Error('La fecha de auditoría es inválida.')
  const values = cleanCandidates(candidates).map(candidate => ({
    id: candidate.id, email: candidate.email, name: candidate.name, provider: candidate.provider, plan: candidate.plan,
    cost: candidate.cost, review: candidate.review,
    ...(candidate.status !== undefined ? { status: candidate.status } : {}),
    ...(candidate.note !== undefined ? { note: candidate.note } : {}),
    ...(candidate.assignee !== undefined ? { assignee: candidate.assignee } : {}),
  }))
  return validateSnapshot({ type: SNAPSHOT_TYPE, version: SNAPSHOT_VERSION, complete: true, provider, createdAt: new Date(time).toISOString(), allLicenseCount, candidateCount: values.length, candidates: values })
}

export function parseSnapshot(text: string): Snapshot {
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error('El archivo de snapshot no es un JSON válido.') }
  return validateSnapshot(input)
}

export function compareSnapshots(previousInput: unknown, nextInput: unknown): SnapshotComparison {
  const previous = validateSnapshot(previousInput)
  const next = validateSnapshot(nextInput)
  if (normalizeProvider(previous.provider) !== normalizeProvider(next.provider)) throw new Error('Sólo se pueden comparar auditorías del mismo proveedor.')
  if (epoch(previous.createdAt) >= epoch(next.createdAt)) throw new Error('Elegí primero la auditoría anterior y luego una de fecha posterior.')
  const old = new Map(previous.candidates.map(candidate => [candidate.id, candidate]))
  const recent = new Map(next.candidates.map(candidate => [candidate.id, candidate]))
  return {
    previous, next,
    new: next.candidates.filter(candidate => !old.has(candidate.id)),
    persistent: next.candidates.filter(candidate => old.has(candidate.id)),
    noLongerPresent: previous.candidates.filter(candidate => !recent.has(candidate.id)),
    costChanges: next.candidates.filter(candidate => old.has(candidate.id) && costToCents(old.get(candidate.id)!.cost) !== costToCents(candidate.cost))
      .map(candidate => ({ id: candidate.id, email: candidate.email, previousCost: old.get(candidate.id)!.cost, nextCost: candidate.cost })),
  }
}
