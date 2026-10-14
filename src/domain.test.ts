import { describe, expect, it } from 'vitest'
import {
  compareSnapshots, costToCents, createSnapshot, filterCandidates, isExpired, licenseId,
  normalizeEmail, parseCsv, parseMonthlyCost, parseSnapshot, reconcile, SESSION_MAX_AGE_MS,
  suggestEmailHeader, summarize, validateEmployees, validateLicenseFiles, validateLicenses, validateSnapshot,
  type Candidate, type License,
} from './domain'

function license(email: string, cost: number | null = null, provider = 'Slack'): License {
  return { id: licenseId(provider, email), email, name: 'Persona de prueba', provider, plan: 'Pro', cost }
}
function candidate(email: string, cost: number | null = null, review: Candidate['review'] = 'pending', provider = 'Slack'): Candidate {
  return { ...license(email, cost, provider), review }
}

describe('CSV y asignación de columnas', () => {
  it('interpreta BOM, punto y coma, comillas escapadas y salto de línea dentro de un nombre', () => {
    const result = parseCsv('\uFEFFCorreo;Nombre;Costo mensual USD\r\na@empresa.com;"Ana; \"\"A\"\"\nGarcía";"12,50"\r\n')
    expect(result.headers).toEqual(['Correo', 'Nombre', 'Costo mensual USD'])
    expect(result.rows[0].Nombre).toBe('Ana; "A"\nGarcía')
    const validated = validateLicenses(result, 'Correo', 'Slack')
    expect(validated.valid).toBe(true)
    expect(validated.licenses[0].cost).toBe(12.5)
  })

  it('admite un CSV de una sola columna y permite asignar un encabezado distinto', () => {
    const result = parseCsv('Cuenta corporativa\na@empresa.com\nb@empresa.com\n')
    expect(validateEmployees(result, 'Cuenta corporativa').employees).toHaveLength(2)
    expect(validateEmployees(result, 'email').valid).toBe(false)
  })

  it('bloquea encabezados duplicados, columnas adicionales y comillas incompletas', () => {
    expect(parseCsv('Email,email\na@empresa.com,b@empresa.com').issues.some(issue => issue.severity === 'error')).toBe(true)
    const extra = parseCsv('email,nombre\na@empresa.com,Ana,otra')
    expect(extra.issues.some(issue => issue.row === 2)).toBe(true)
    expect(validateEmployees(extra, 'email').valid).toBe(false)
    expect(parseCsv('email,nombre\na@empresa.com,"Ana').issues.some(issue => issue.severity === 'error')).toBe(true)
  })

  it('no muta el prototipo cuando el CSV contiene un encabezado reservado', () => {
    const result = parseCsv('__proto__,email\ntexto,a@empresa.com')
    expect(Object.getPrototypeOf(result.rows[0])).toBe(null)
    expect(result.rows[0].__proto__).toBe('texto')
    expect(validateEmployees(result, 'email').valid).toBe(true)
  })

  it('explica cómo corregir un archivo vacío o con sólo espacios', () => {
    for (const text of ['', '  \n  ']) {
      const message = parseCsv(text).issues[0].message
      expect(message).toContain('El archivo está vacío')
      expect(message).toContain('encabezado')
    }
  })
  it('no inventa columnas a partir de un archivo vacío o binario', () => {
    expect(parseCsv('').rows).toEqual([])
    expect(parseCsv('email\0a@empresa.com').issues[0].severity).toBe('error')
  })
})

describe('identidad, duplicados y nómina vigente', () => {
  it('sólo recorta espacios y cambia mayúsculas, sin modificar puntos ni tags', () => {
    expect(normalizeEmail(' ANA.P+externo@EMPRESA.COM ')).toBe('ana.p+externo@empresa.com')
    const licenses = [license(' ANA@EMPRESA.COM '), license('ana+otro@empresa.com'), license('a.na@empresa.com')]
    const result = reconcile(licenses, [{ email: 'ana@empresa.com', name: 'Ana' }])
    expect(result.map(item => item.email)).toEqual(['ana+otro@empresa.com', 'a.na@empresa.com'])
    expect(result.every(item => item.review === 'pending')).toBe(true)
  })

  it('no usa nombres iguales para reconciliar ni cuenta personal sin licencia como candidato', () => {
    const result = reconcile([license('otra@empresa.com')], [{ email: 'vigente@empresa.com', name: 'Persona de prueba' }])
    expect(result).toHaveLength(1)
    expect(summarize(result, [license('otra@empresa.com')]).matchedCount).toBe(0)
    expect(reconcile([], [{ email: 'vigente@empresa.com', name: 'Ana' }])).toEqual([])
  })

  it('consolida duplicados exactos y deja un aviso con la fila de origen', () => {
    const result = validateLicenses(parseCsv('email,nombre,costo\na@empresa.com,Ana,20\n A@EMPRESA.COM ,Ana,20'), 'email', 'Slack')
    expect(result.valid).toBe(true)
    expect(result.licenses).toHaveLength(1)
    expect(result.licenses[0].originalEmail).toBe('a@empresa.com')
    expect(result.duplicateCount).toBe(1)
    expect(result.issues).toContainEqual(expect.objectContaining({ row: 3, severity: 'warning' }))
  })

  it('no elige una versión de una cuenta con costo contradictorio', () => {
    const result = validateLicenses(parseCsv('email,nombre,costo\na@empresa.com,Ana,20\na@empresa.com,Ana,45'), 'email', 'Slack')
    expect(result.valid).toBe(false)
    expect(result.licenses).toEqual([])
    expect(result.issues.filter(issue => issue.severity === 'error')).toHaveLength(2)
    expect(() => reconcile([license('a@empresa.com', 20), license('a@empresa.com', 45)], [])).toThrow(/contradictorios/)
  })

  it('bloquea email inválido, nómina inactiva y proveedor contradictorio', () => {
    const staff = validateEmployees(parseCsv('email,nombre,estado\nsin-email,Ana,activo\nb@empresa.com,Beto,baja'), 'email')
    expect(staff.valid).toBe(false)
    expect(staff.employees).toEqual([])
    expect(validateLicenses(parseCsv('email,proveedor\na@empresa.com,Jira'), 'email', 'Slack').valid).toBe(false)
    expect(validateEmployees(parseCsv('email\n.ana@empresa.com\nana.@empresa.com'), 'email').valid).toBe(false)
  })

  it('conserva el email original y expone la identidad normalizada por separado', () => {
    const result = validateLicenses(parseCsv('email\n" ANA@EMPRESA.COM "'), 'email', 'Slack')
    expect(result.licenses[0]).toMatchObject({ email: 'ana@empresa.com', originalEmail: ' ANA@EMPRESA.COM ' })
  })

  it('cuenta el mismo email en dos proveedores como dos licencias independientes', () => {
    const values = [license('a@empresa.com', 20, 'Slack'), license('a@empresa.com', 45, 'Jira')]
    const result = reconcile(values, [])
    expect(result).toHaveLength(2)
    expect(summarize(result, values).potentialSavings).toBe(65)
  })
})

describe('consolidación de licencias de varios archivos y proveedores', () => {
  it('acepta tres proveedores en un CSV sin imponer el proveedor predeterminado', () => {
    const table = parseCsv('email,name,provider,plan,cost\na@example.invalid,Ana,Slack,Pro,20\na@example.invalid,Ana,Jira,Standard,45\nb@example.invalid,Beto,Google Workspace,Business,0')
    const result = validateLicenseFiles([{ name: 'demo.csv', table, emailHeader: 'email' }], 'Slack')
    expect(result.valid).toBe(true)
    expect(result.licenses.map(item => item.provider)).toEqual(['Slack', 'Jira', 'Google Workspace'])
    expect(reconcile(result.licenses, [])).toHaveLength(3)
    expect(summarize(reconcile(result.licenses, []), result.licenses).potentialSavings).toBe(65)
  })

  it('resuelve aliases independientemente por archivo y usa el default sólo si falta el proveedor', () => {
    const result = validateLicenseFiles([
      { name: 'slack.csv', emailHeader: 'Correo', table: parseCsv('Correo;Nombre completo;Plataforma;Licencia;Costo mensual USD;Estado\na@example.invalid;Ana;Slack;Pro;12,50;activo') },
      { name: 'jira.csv', emailHeader: 'Account', table: parseCsv('Account,Display name,Provider,Subscription,Monthly cost USD,Account status\nb@example.invalid,Beto,Jira,Standard,45,active') },
      { name: 'sin-proveedor.csv', emailHeader: 'email', table: parseCsv('email,name,plan\nc@example.invalid,Cora,Business') },
    ], 'Google Workspace', 8)
    expect(result.valid).toBe(true)
    expect(result.licenses).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: 'a@example.invalid', name: 'Ana', provider: 'Slack', plan: 'Pro', cost: 12.5, status: 'activo' }),
      expect.objectContaining({ email: 'b@example.invalid', name: 'Beto', provider: 'Jira', plan: 'Standard', cost: 45, status: 'active' }),
      expect.objectContaining({ email: 'c@example.invalid', name: 'Cora', provider: 'Google Workspace', plan: 'Business', cost: 8 }),
    ]))
  })

  it('consolida duplicados entre archivos y describe ambas ubicaciones de origen', () => {
    const result = validateLicenseFiles([
      { name: 'primero.csv', emailHeader: 'email', table: parseCsv('email,name,provider,cost\na@example.invalid,Ana,Slack,20') },
      { name: 'segundo.csv', emailHeader: 'Correo', table: parseCsv('Correo;Nombre;Proveedor;Costo\n A@EXAMPLE.INVALID ;Ana;slack;20') },
    ], 'Slack')
    expect(result.valid).toBe(true)
    expect(result.licenses).toHaveLength(1)
    expect(result.duplicateCount).toBe(1)
    expect(result.issues).toContainEqual(expect.objectContaining({ file: 'segundo.csv', row: 2, severity: 'warning', message: expect.stringContaining('fila 2 de primero.csv') }))
  })

  it('bloquea una identidad contradictoria aunque cada archivo sea válido por separado', () => {
    const result = validateLicenseFiles([
      { name: 'primero.csv', emailHeader: 'email', table: parseCsv('email,name,cost\na@example.invalid,Ana,20') },
      { name: 'segundo.csv', emailHeader: 'Correo', table: parseCsv('Correo;Nombre;Costo\na@example.invalid;Ana;45') },
    ], 'Slack')
    expect(result.valid).toBe(false)
    expect(result.licenses).toEqual([])
    expect(result.issues.filter(issue => issue.severity === 'error').map(issue => [issue.file, issue.row])).toEqual([['primero.csv', 2], ['segundo.csv', 2]])
  })

  it('mantiene el límite global de 1000 aunque cada archivo tenga menos filas', () => {
    const file = (name: string, offset: number) => ({ name, emailHeader: 'email', table: parseCsv('email\n' + Array.from({ length: 501 }, (_, index) => `p${offset + index}@example.invalid`).join('\n')) })
    const result = validateLicenseFiles([file('a.csv', 0), file('b.csv', 501)], 'Slack')
    expect(result.valid).toBe(false)
    expect(result.issues.some(issue => issue.message.includes('límite global'))).toBe(true)
  })

  it('informa el archivo y la línea física real después de un campo multilínea', () => {
    const result = validateLicenseFiles([{ name: 'lineas.csv', emailHeader: 'email', table: parseCsv('email,name,cost\n\na@example.invalid,"Ana\nGarcía",20\nb@example.invalid,Beto,-2') }], 'Slack')
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ file: 'lineas.csv', row: 5, severity: 'error' }))
  })
})

describe('costos conocidos, selección y cálculos en centavos', () => {
  it('distingue costo vacío de cero, admite decimal local y rechaza valores ambiguos', () => {
    expect(parseMonthlyCost('')).toBe(null)
    expect(parseMonthlyCost('0')).toBe(0)
    expect(parseMonthlyCost('12,50')).toBe(12.5)
    for (const value of ['-1', 'USD 20', '1,000', '12.345', 'NaN', 'Infinity']) expect(() => parseMonthlyCost(value)).toThrow()
    expect(() => costToCents(Number.NaN)).toThrow()
    expect(() => costToCents(-1)).toThrow()
  })

  it('suma sólo precios conocidos y mantiene el denominador desconocido visible', () => {
    const values = [candidate('a@empresa.com', 20, 'confirmed'), candidate('b@empresa.com', 45, 'retained'), candidate('c@empresa.com', null, 'confirmed'), candidate('d@empresa.com', 0)]
    const result = summarize(values, values)
    expect(result).toMatchObject({ candidateCount: 4, potentialSavings: 65, unknownCostCount: 1, knownCostCount: 3, selectedCount: 2, selectedSavings: 20, selectedUnknownCostCount: 1 })
  })

  it('evita errores de coma flotante y no cambia totales generales al filtrar', () => {
    const values = [candidate('a@empresa.com', 0.1, 'confirmed'), candidate('b@empresa.com', 0.2)]
    expect(summarize(values, values).potentialSavingsCents).toBe(30)
    expect(summarize(values, values).potentialSavings).toBe(0.3)
    expect(filterCandidates(values, 'b@').map(value => value.email)).toEqual(['b@empresa.com'])
    expect(values).toHaveLength(2)
    expect(summarize(values, values).candidateCount).toBe(2)
    expect(() => summarize([values[0], values[0]], values)).toThrow(/repetidos/)
  })

  it('usa un precio predeterminado explícito pero no convierte costos anuales', () => {
    const result = validateLicenses(parseCsv('email,nombre\na@empresa.com,Ana'), 'email', 'Slack', 9.99)
    expect(result.licenses[0]).toMatchObject({ cost: 9.99, costSource: 'default' })
    expect(validateLicenses(parseCsv('email,costo anual\na@empresa.com,120'), 'email', 'Slack').licenses[0].cost).toBe(null)
  })
})

describe('snapshots completos para comparación posterior', () => {
  const previousDate = '2026-10-01T12:00:00.000Z'
  const nextDate = '2026-11-01T12:00:00.000Z'
  const values = [candidate('a@empresa.com', 20, 'confirmed'), candidate('b@empresa.com', null, 'retained')]

  it('incluye todas las revisiones y omite originales/datos de nómina', () => {
    const snapshot = createSnapshot(values, 'Slack', 5, previousDate)
    expect(snapshot.candidateCount).toBe(2)
    expect(snapshot.candidates[1].review).toBe('retained')
    expect(snapshot.candidates.every(value => !('originalEmail' in value))).toBe(true)
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('rechaza checklist parcial, conteos alterados, identidades duplicadas y fechas imposibles', () => {
    const full = createSnapshot(values, 'Slack', 5, previousDate)
    expect(() => validateSnapshot({ ...full, complete: false })).toThrow(/completo/)
    expect(() => validateSnapshot({ ...full, type: 'checklist' })).toThrow(/completo/)
    expect(() => validateSnapshot({ ...full, candidateCount: 99 })).toThrow(/conteos/)
    expect(() => validateSnapshot({ ...full, candidates: [values[0], values[0]] })).toThrow(/repetidos/)
    expect(() => validateSnapshot({ ...full, createdAt: '2026-02-31T00:00:00.000Z' })).toThrow(/fecha/)
    expect(() => validateSnapshot({ ...full, employees: [{ email: 'a@empresa.com' }] })).toThrow(/campos/)
  })

  it('distingue nuevos, persistentes, ausencias y cambio de costo sin afirmar bajas', () => {
    const first = createSnapshot(values, 'Slack', 5, previousDate)
    const next = createSnapshot([candidate('a@empresa.com', 25), candidate('c@empresa.com', 10)], 'Slack', 6, nextDate)
    const result = compareSnapshots(first, next)
    expect(result.new.map(value => value.email)).toEqual(['c@empresa.com'])
    expect(result.persistent.map(value => value.email)).toEqual(['a@empresa.com'])
    expect(result.noLongerPresent.map(value => value.email)).toEqual(['b@empresa.com'])
    expect(result.costChanges[0]).toMatchObject({ previousCost: 20, nextCost: 25 })
    expect(JSON.stringify(result)).not.toContain('cancelled')
  })

  it('rechaza proveedores diferentes, versiones futuras, fechas iguales y orden invertido', () => {
    const first = createSnapshot(values, 'Slack', 5, previousDate)
    const next = createSnapshot(values, 'Slack', 5, nextDate)
    expect(() => compareSnapshots(first, { ...next, version: 2 })).toThrow()
    expect(() => compareSnapshots(first, first)).toThrow(/posterior/)
    expect(() => compareSnapshots(next, first)).toThrow(/posterior/)
    expect(() => compareSnapshots(first, createSnapshot([], 'Jira', 0, nextDate))).toThrow(/proveedor/)
    expect(() => parseSnapshot('{')).toThrow(/JSON/)
  })
})

describe('sesión de máximo 24 horas y volumen de referencia', () => {
  it('expira en el límite exacto y trata fechas inválidas o futuras como expiradas', () => {
    const created = Date.parse('2026-10-03T10:00:00.000Z')
    expect(isExpired(created, created + SESSION_MAX_AGE_MS - 1)).toBe(false)
    expect(isExpired(created, created + SESSION_MAX_AGE_MS)).toBe(true)
    expect(isExpired('nunca', created)).toBe(true)
    expect(isExpired('2026-02-31T00:00:00.000Z', created)).toBe(true)
    expect(isExpired(created + 1, created)).toBe(true)
    expect(isExpired(created, Number.NaN)).toBe(true)
  })

  it('valida y concilia correctamente 250 personas y 1000 cuentas en menos de 60 segundos', () => {
    const rosterCsv = 'email,nombre\n' + Array.from({ length: 250 }, (_, i) => `persona${i}@empresa.com,Persona ${i}`).join('\n')
    const licensesCsv = 'email,nombre,costo\n' + Array.from({ length: 1000 }, (_, i) => `persona${i}@empresa.com,Persona ${i},1.25`).join('\n')
    const start = performance.now()
    const staff = validateEmployees(parseCsv(rosterCsv), 'email')
    const licenses = validateLicenses(parseCsv(licensesCsv), 'email', 'Slack')
    const result = reconcile(licenses.licenses, staff.employees)
    const elapsed = performance.now() - start
    expect(staff.valid).toBe(true)
    expect(licenses.valid).toBe(true)
    expect(result).toHaveLength(750)
    expect(summarize(result, licenses.licenses).potentialSavings).toBe(937.5)
    expect(elapsed).toBeLessThan(60_000)
  })

  it('bloquea archivos que superan el volumen del MVP', () => {
    const rows = Array.from({ length: 251 }, (_, i) => ({ email: `persona${i}@empresa.com` }))
    expect(validateEmployees({ headers: ['email'], rows }, 'email').valid).toBe(false)
  })
})

describe('columna de email en exportaciones reales de las plataformas (SPIKE-01)', () => {
  const atlassian = ['User ID', 'User name', 'Email', 'User status', 'Added to org', 'Org role']
  const google = ['First Name [Required]', 'Last Name [Required]', 'Email Address [Required]', 'Password [Required]', 'Org Unit Path [Required]']

  it('reconoce Email en la exportación de usuarios de Atlassian, que no es la primera columna', () => {
    expect(suggestEmailHeader(atlassian)).toBe('Email')
  })
  it('reconoce Email Address [Required] en el CSV de usuarios de Google Workspace', () => {
    expect(suggestEmailHeader(google)).toBe('Email Address [Required]')
  })
  it('conserva el reconocimiento de los encabezados que ya se aceptaban', () => {
    expect(suggestEmailHeader(['nombre', 'correo_electronico'])).toBe('correo_electronico')
    expect(suggestEmailHeader(['username', 'E-mail', 'status'])).toBe('E-mail')
  })
  it('no adivina cuando ningún encabezado habla de email', () => {
    expect(suggestEmailHeader(['ident', 'persona', 'sector', 'casilla'])).toBe('')
  })
  it('valida un CSV con encabezados de Google sin renombrar columnas y normaliza el email', () => {
    const table = parseCsv('First Name [Required],Last Name [Required],Email Address [Required]\nAna,Pérez,  Ana@Empresa.COM \n')
    const result = validateEmployees(table, suggestEmailHeader(table.headers))
    expect(result.valid).toBe(true)
    expect(result.employees[0].email).toBe('ana@empresa.com')
  })
})
