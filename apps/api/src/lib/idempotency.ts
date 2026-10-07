import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { idempotencyKeys } from "../db/schema/index.js";
import { ApiError } from "../errors.js";

export const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Runs a state-changing handler at most once per `Idempotency-Key` (PRD §12.4). A retry with
 * the same key and body gets the first response replayed; the same key with a different body
 * is rejected, and a retry while the first call is still running gets a 409. Requests without
 * the header run normally. Failed attempts release the key so the client can retry.
 */
export async function withIdempotency<T>(
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  statusCode: number,
  handler: () => Promise<T>,
): Promise<FastifyReply> {
  const rawKey = req.headers["idempotency-key"];
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  if (!key) return reply.status(statusCode).send(await handler());
  if (key.length > 255) throw new ApiError("Idempotency-Key must be at most 255 characters.", 422);

  const route = `${req.method} ${req.routeOptions.url ?? req.url}`;
  const requestHash = createHash("sha256")
    .update(`${req.method}\n${req.url}\n${JSON.stringify(req.body ?? null)}`)
    .digest("hex");

  // Keys older than the TTL are forgotten, so a reused key starts fresh.
  await db
    .delete(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.key, key),
        lt(idempotencyKeys.createdAt, sql`now() - make_interval(hours => ${IDEMPOTENCY_TTL_HOURS})`),
      ),
    );

  const [claimed] = await db
    .insert(idempotencyKeys)
    .values({ userId, key, route, requestHash })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (!claimed) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
      .limit(1);
    if (!existing) throw new ApiError("Please retry the request.", 409);
    if (existing.route !== route || existing.requestHash !== requestHash) {
      throw new ApiError("This Idempotency-Key was already used for a different request.", 422);
    }
    if (existing.statusCode === null) {
      throw new ApiError("This request is still being processed. Please wait a moment.", 409);
    }
    return reply.status(existing.statusCode).header("Idempotent-Replayed", "true").send(existing.response);
  }

  let result: T;
  try {
    result = await handler();
  } catch (err) {
    await db.delete(idempotencyKeys).where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
    throw err;
  }

  await db
    .update(idempotencyKeys)
    .set({ statusCode, response: result as unknown })
    .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));

  return reply.status(statusCode).send(result);
}

/** Housekeeping for the daily cron. */
export async function purgeExpiredIdempotencyKeys() {
  await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, sql`now() - make_interval(hours => ${IDEMPOTENCY_TTL_HOURS})`));
}
