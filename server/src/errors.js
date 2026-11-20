//Unified errors: { "error": { "code": "BAD_REQUEST", "message": "human readable text" } }
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (msg) => new ApiError(400, 'BAD_REQUEST', msg)
export const notFound = (msg) => new ApiError(404, 'NOT_FOUND', msg)

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function errorMiddleware(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } })
}
