import type { FastifyInstance } from "fastify";
import { getInboxThreads } from "./inbox.service.js";
import { requireAuth } from "../../plugins/authenticate.js";

export async function inboxRoutes(fastify: FastifyInstance) {
  fastify.get("/inbox", async (req, reply) => {
    const user = requireAuth(req);
    return reply.send(await getInboxThreads(user));
  });
}
