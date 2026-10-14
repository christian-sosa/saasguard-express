// Genera la muestra ficticia del SPIKE-01: 250 personas de RRHH y 1.000 filas SaaS.
// Uso: node scripts/generar-muestra-volumen.mjs [carpeta-de-salida]
// Resultado esperado: 1.000 licencias, 500 coinciden con la nómina, 500 candidatas y USD 2.253,00 de potencial conocido.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'muestra-volumen'
mkdirSync(out, { recursive: true })

const providers = ['Google Workspace', 'Slack', 'Jira', 'Trello']
const people = Array.from({ length: 250 }, (_, i) => `persona${String(i).padStart(4, '0')}@example.test,Persona ${i},IT`)
const licenses = Array.from({ length: 1000 }, (_, i) => {
  const email = i < 500 ? `persona${String(i % 250).padStart(4, '0')}@example.test` : `ext${i}@example.test`
  return `${email},N ${i},${providers[Math.floor(i / 250)]},Plan,${(i % 7) + 1}.5`
})

writeFileSync(join(out, 'nomina_250.csv'), `email,nombre,area\n${people.join('\n')}\n`)
writeFileSync(join(out, 'licencias_1000.csv'), `email,nombre,proveedor,plan,costo_mensual\n${licenses.join('\n')}\n`)

const candidates = licenses.slice(500)
const cents = candidates.reduce((sum, row) => sum + Math.round(Number(row.split(',')[4]) * 100), 0)
console.log(JSON.stringify({ personas: 250, licencias: 1000, coinciden: 500, candidatas: candidates.length, potencialUSD: cents / 100 }))
