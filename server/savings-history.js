import { createHash } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { createSessionReader } from './auth-server.js'
import { json, readBody, RequestError, sameOrigin } from './http.js'

const pageSize = 50
const maxCandidates = 1000
const allowedProviders = new Set(['Google Workspace', 'Slack', 'Jira', 'Trello', 'Figma', 'Zoom', 'Notion', 'Otro'])
const writeRoles = new Set(['admin', 'it', 'people', 'finance'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const fields = [
  'auditId', 'providers', 'potentialSavingsCents', 'selectedSavingsCents',
  'candidateCount', 'selectedCount', 'unknownCostCount', 'selectedUnknownCostCount',
]
const unavailable = 'El historial de auditorías no está disponible. Volvé a intentar más tarde.'

function ownerKey(user) {
  const identity = user.method === 'google'
    ? ['google', user.googleSubject]
    : ['password', user.username, user.email]
  return createHash('sha256').update(JSON.stringify(['saasguard-history:v1', ...identity])).digest('hex')
}

function validateSummary(body) {
  const {
    auditId, providers, potentialSavingsCents, selectedSavingsCents,
    candidateCount, selectedCount, unknownCostCount, selectedUnknownCostCount,
  } = body
  const counts = [candidateCount, selectedCount, unknownCostCount, selectedUnknownCostCount]
  const amounts = [potentialSavingsCents, selectedSavingsCents]
  if (Object.keys(body).length !== fields.length || !fields.every((key) => Object.hasOwn(body, key))
    || typeof auditId !== 'string' || !uuid.test(auditId)
    || !Array.isArray(providers) || !providers.length || providers.length > allowedProviders.size
    || !providers.every((provider) => allowedProviders.has(provider)) || new Set(providers).size !== providers.length
    || !counts.every((count) => Number.isInteger(count) && count >= 0 && count <= maxCandidates)
    || selectedCount > candidateCount || unknownCostCount > candidateCount
    || selectedUnknownCostCount > selectedCount || selectedUnknownCostCount > unknownCostCount
    || unknownCostCount - selectedUnknownCostCount > candidateCount - selectedCount
    || !amounts.every((cents) => Number.isSafeInteger(cents) && cents >= 0)
    || selectedSavingsCents > potentialSavingsCents
    || (candidateCount === unknownCostCount && potentialSavingsCents !== 0)
    || (selectedCount === selectedUnknownCostCount && selectedSavingsCents !== 0)) {
    throw new RequestError(400, 'El resumen de la auditoría no es válido.')
  }
  return body
}

function readCursor(url) {
  try {
    const values = new URL(url, 'http://localhost').searchParams.getAll('cursor')
    if (!values.length) return null
    const [encoded] = values
    if (values.length !== 1 || encoded.length > 120 || !/^[\w-]+$/.test(encoded)) throw new Error()
    const [savedAt, auditId, extra] = Buffer.from(encoded, 'base64url').toString().split('/')
    if (extra !== undefined || !uuid.test(auditId) || new Date(savedAt).toISOString() !== savedAt
      || savedAt.length !== 24) throw new Error()
    return { savedAt, auditId }
  } catch {
    throw new RequestError(400, 'La página del historial no es válida.')
  }
}

const summaryColumns = `
  audit_id AS "auditId",
  saved_at AS "savedAt",
  providers,
  potential_savings_cents AS "potentialSavingsCents",
  selected_savings_cents AS "selectedSavingsCents",
  candidate_count AS "candidateCount",
  selected_count AS "selectedCount",
  unknown_cost_count AS "unknownCostCount",
  selected_unknown_cost_count AS "selectedUnknownCostCount"
`

function publicEntry(row) {
  return {
    ...row,
    savedAt: new Date(row.savedAt).toISOString(),
    potentialSavingsCents: Number(row.potentialSavingsCents),
    selectedSavingsCents: Number(row.selectedSavingsCents),
  }
}

function createNeonStore(databaseUrl) {
  if (!databaseUrl) return null
  const sql = neon(databaseUrl)
  return {
    async list(owner, cursor, limit) {
      const rows = await sql.query(`
        SELECT ${summaryColumns} FROM savings_history
        WHERE owner_key = $1
          AND ($2::timestamptz IS NULL OR (saved_at, audit_id) < ($2::timestamptz, $3::uuid))
        ORDER BY saved_at DESC, audit_id DESC
        LIMIT $4
      `, [owner, cursor?.savedAt ?? null, cursor?.auditId ?? null, limit])
      return rows.map(publicEntry)
    },
    async save(owner, summary) {
      const {
        auditId, providers, potentialSavingsCents, selectedSavingsCents,
        candidateCount, selectedCount, unknownCostCount, selectedUnknownCostCount,
      } = summary
      const [row] = await sql.query(`
        INSERT INTO savings_history (
          owner_key, audit_id, providers, potential_savings_cents, selected_savings_cents,
          candidate_count, selected_count, unknown_cost_count, selected_unknown_cost_count
        ) VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8, $9)
        ON CONFLICT (owner_key, audit_id) DO UPDATE SET
          providers = EXCLUDED.providers,
          potential_savings_cents = EXCLUDED.potential_savings_cents,
          selected_savings_cents = EXCLUDED.selected_savings_cents,
          candidate_count = EXCLUDED.candidate_count,
          selected_count = EXCLUDED.selected_count,
          unknown_cost_count = EXCLUDED.unknown_cost_count,
          selected_unknown_cost_count = EXCLUDED.selected_unknown_cost_count
        RETURNING ${summaryColumns}
      `, [
        owner, auditId, providers, potentialSavingsCents, selectedSavingsCents,
        candidateCount, selectedCount, unknownCostCount, selectedUnknownCostCount,
      ])
      return publicEntry(row)
    },
  }
}

export function createSavingsHistoryHandler({ env = process.env, now = Date.now, store } = {}) {
  const session = createSessionReader({ env, now })
  let history = store
  try {
    history ??= createNeonStore(env.DATABASE_URL)
  } catch {
    history = null
  }

  return async function savingsHistoryHandler(req, res) {
    try {
      if (req.method !== 'GET' && req.method !== 'PUT') {
        res.setHeader('Allow', 'GET, PUT')
        throw new RequestError(405, 'Método no permitido.')
      }
      if (!session) throw new RequestError(503, unavailable)
      const { user, sessionTag, secure } = session(req)
      if (!user || (user.method === 'google' && !user.googleSubject)) {
        throw new RequestError(401, 'Volvé a iniciar sesión para acceder a tu historial.')
      }
      if (req.headers['x-saasguard-session'] !== sessionTag) {
        throw new RequestError(409, 'La sesión cambió en otra pestaña. Recargá la página antes de usar el historial.')
      }
      if (!history) throw new RequestError(503, unavailable)
      const owner = ownerKey(user)
      if (req.method === 'GET') {
        const rows = await history.list(owner, readCursor(req.url), pageSize + 1)
        const entries = rows.slice(0, pageSize)
        const last = entries.at(-1)
        const nextCursor = rows.length > pageSize
          ? Buffer.from(last.savedAt + '/' + last.auditId).toString('base64url')
          : null
        return json(res, 200, { entries, nextCursor })
      }
      if (!sameOrigin(req, secure)) throw new RequestError(403, 'Origen de la solicitud no permitido.')
      if (!writeRoles.has(user.role)) throw new RequestError(403, 'Tu rol no permite guardar auditorías.')
      const summary = validateSummary(await readBody(req))
      return json(res, 200, { entry: await history.save(owner, summary) })
    } catch (error) {
      return error instanceof RequestError
        ? json(res, error.status, { error: error.message })
        : json(res, 503, { error: unavailable })
    }
  }
}
