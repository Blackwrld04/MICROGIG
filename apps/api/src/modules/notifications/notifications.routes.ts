import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserNotifications, markNotificationsAsRead, getNotificationPreferences, updateNotificationPreferences } from "./notifications.service.js";
import { requireAuth } from "../../plugins/authenticate.js";
import { unprocessable } from "../../errors.js";

const prefsBody = z
  .object({
    orderEmail: z.boolean().optional(),
    inboxEmail: z.boolean().optional(),
    promoEmail: z.boolean().optional(),
  })
  .strict();

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.get("/notifications", async (req, reply) => {
    const user = requireAuth(req);
    return reply.send(await getUserNotifications(user.id));
  });

  fastify.post("/notifications/read", async (req, reply) => {
    const user = requireAuth(req);
    return reply.send(await markNotificationsAsRead(user.id));
  });

  fastify.get("/notification-prefs", async (req, reply) => {
    const user = requireAuth(req);
    return reply.send(await getNotificationPreferences(user.id));
  });

  fastify.put("/notification-prefs", async (req, reply) => {
    const user   = requireAuth(req);
    const parsed = prefsBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Preferences must be true/false values for orderEmail, inboxEmail or promoEmail.");
    return reply.send(await updateNotificationPreferences(user.id, parsed.data));
  });
}
