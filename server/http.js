const maxBodyBytes = 16 * 1024

export class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function sameOrigin(req, secure) {
  const { host, origin } = req.headers
  if (typeof host !== 'string' || typeof origin !== 'string') return false
  try {
    return origin === new URL((secure ? 'https://' : 'http://') + host).origin
  } catch {
    return false
  }
}

export async function readBody(req, invalidMessage = 'La solicitud no es válida.') {
  const contentType = req.headers['content-type']
  if (typeof contentType !== 'string' || contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Enviá la solicitud en formato JSON.')
  }

  if (Number(req.headers['content-length']) > maxBodyBytes) {
    throw new RequestError(413, 'La solicitud supera el tamaño permitido.')
  }
  let body
  try {
    body = req.body
  } catch {
    throw new RequestError(400, invalidMessage)
  }
  if (body === undefined) {
    const chunks = []
    let bytes = 0
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > maxBodyBytes) {
        req.resume()
        throw new RequestError(413, 'La solicitud supera el tamaño permitido.')
      }
      chunks.push(buffer)
    }
    body = Buffer.concat(chunks)
  }

  if (Buffer.isBuffer(body) || typeof body === 'string') {
    if (Buffer.byteLength(body) > maxBodyBytes) throw new RequestError(413, 'La solicitud supera el tamaño permitido.')
    try {
      body = JSON.parse(body.toString())
    } catch {
      throw new RequestError(400, invalidMessage)
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestError(400, invalidMessage)
  }
  if (Buffer.byteLength(JSON.stringify(body)) > maxBodyBytes) {
    throw new RequestError(413, 'La solicitud supera el tamaño permitido.')
  }
  return body
}

export function json(res, status, value) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(value))
}
