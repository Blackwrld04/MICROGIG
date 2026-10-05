import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createDeliveryPresignedUpload,
  createGalleryPresignedUpload,
  getDeliveryDownloadUrl,
} from "./storage.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { unprocessable, notFound, forbidden } from "../../errors.js";
import { db } from "../../db/connection.js";
import { orders, deliveries } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

const presignDeliveryBody = z.object({
  filename:    z.string().min(1),
  contentType: z.string().min(1),
  fileSize:    z.number().int().min(1),
  orderId:     z.string().min(1, "orderId is required"),
});

const presignUploadBody = z.object({
  filename:    z.string().min(1),
  contentType: z.string().min(1),
  fileSize:    z.number().int().min(1),
});

export async function storageRoutes(fastify: FastifyInstance) {
  fastify.post("/deliveries/presign-upload", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    const parsed = presignDeliveryBody.safeParse(req.body);
    if (!parsed.success) {
      throw unprocessable("Invalid upload request", parsed.error.flatten().fieldErrors as any);
    }

    const result = await createDeliveryPresignedUpload(user.id, {
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      fileSize: parsed.data.fileSize,
      orderId: parsed.data.orderId,
    });
    return reply.send(result);
  });

  fastify.post("/uploads/presign", async (req, reply) => {
    const user = requireAuth(req);
    const parsed = presignUploadBody.safeParse(req.body);
    if (!parsed.success) {
      throw unprocessable("Invalid upload request", parsed.error.flatten().fieldErrors as any);
    }

    const result = await createGalleryPresignedUpload(user.id, parsed.data);
    return reply.send(result);
  });

  fastify.get("/deliveries/:fileKey/download", async (req, reply) => {
    const user = requireAuth(req);
    const { fileKey } = req.params as { fileKey: string };
    const decodedKey = decodeURIComponent(fileKey);

    const match = decodedKey.match(/^deliveries\/([^/]+)/);
    let orderId = match ? match[1] : null;

    if (!orderId) {
      const [deliv] = await db
        .select({ orderId: deliveries.orderId })
        .from(deliveries)
        .where(eq(deliveries.storageKey, decodedKey))
        .limit(1);
      if (deliv) orderId = deliv.orderId;
    }

    if (!orderId) {
      throw notFound("Deliverable not found");
    }

    const [order] = await db
      .select({ buyerId: orders.buyerId, sellerId: orders.sellerId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw notFound("Order not found");
    }

    if (order.buyerId !== user.id && order.sellerId !== user.id && !user.isAdmin) {
      throw forbidden("You do not have access to this deliverable");
    }

    const result = await getDeliveryDownloadUrl(decodedKey);
    return reply.send(result);
  });
}

