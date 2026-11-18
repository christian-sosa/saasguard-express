import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

try {
  const sql = neon(process.env.DATABASE_URL)
  const migration = new URL('../server/migrations/001-savings-history.sql', import.meta.url)
  await sql.query(await readFile(migration, 'utf8'))
  const [result] = await sql`SELECT to_regclass('savings_history') IS NOT NULL AS ready`
  if (!result?.ready) throw new Error('Table unavailable')
  console.log('Tabla de historial lista.')
} catch {
  console.error('No se pudo aplicar la migración del historial. Verificá la conexión dedicada.')
  process.exitCode = 1
}
