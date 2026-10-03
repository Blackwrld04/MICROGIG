import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

// ── API Error ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Convenience factories
export const unauthorized = (msg = "Not signed in") => new ApiError(msg, 401);
export const forbidden = (msg = "Forbidden") => new ApiError(msg, 403);
export const notFound = (msg = "Not found") => new ApiError(msg, 404);
export const conflict = (msg = "Concurrent state change. Please refresh.") => new ApiError(msg, 409);
export const unprocessable = (msg: string, fieldErrors?: Record<string, string>) =>
  new ApiError(msg, 422, fieldErrors);
export const paymentRequired = (msg = "Insufficient wallet balance") => new ApiError(msg, 402);

// ── Fastify Global Error Handler ─────────────────────────────────────────────

export function errorHandler(
  error: FastifyError,
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  // Our own typed errors
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: {
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    });
  }

  // Fastify schema validation errors (ajv)
  if (error.validation) {
    const fieldErrors: Record<string, string> = {};
    for (const v of error.validation) {
      const field = (v.instancePath || (v.params as any)?.missingProperty || "body")
        .replace(/^\//, "");
      fieldErrors[field] = v.message ?? "Invalid value";
    }
    return reply.status(422).send({
      error: { message: "Validation failed", fieldErrors },
    });
  }

  // Known HTTP status codes from Fastify itself (e.g. 404 from route not found)
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: { message: error.message },
    });
  }

  // Unhandled / 5xx
  reply.log.error(error);
  return reply.status(500).send({
    error: { message: "Internal server error" },
  });
}
