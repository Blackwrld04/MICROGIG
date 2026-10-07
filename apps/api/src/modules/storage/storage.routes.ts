import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createDeliveryPresignedUpload,
  createGalleryPresignedUpload,
  getDeliveryDownloadUrl,
  getPrivateObject,
  canDownloadDelivery,
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

// PRD 13.2: 20 presigned URLs per user per hour. Keyed by user, so it runs after auth.
const presignRateLimit = {
  rateLimit: {
    max: 20,
    timeWindow: "1 hour",
    hook: "preHandler" as const,
    keyGenerator: (req: FastifyRequest) => `presign:${req.user?.id ?? req.ip}`,
  },
};

export async function storageRoutes(fastify: FastifyInstance) {
  fastify.post("/deliveries/presign-upload", { config: presignRateLimit }, async (req, reply) => {
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

  fastify.post("/uploads/presign", { config: presignRateLimit }, async (req, reply) => {
    const user = requireRole(req, "FREELANCER"); // only sellers upload gig gallery images
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

    // Only files that were actually submitted as a delivery can be downloaded.
    const [delivery] = await db
      .select({ orderId: deliveries.orderId, fileName: deliveries.fileName })
      .from(deliveries)
      .where(eq(deliveries.storageKey, decodedKey))
      .limit(1);
    if (!delivery) throw notFound("Deliverable not found");

    const [order] = await db
      .select({ buyerId: orders.buyerId, sellerId: orders.sellerId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, delivery.orderId))
      .limit(1);
    if (!order) throw notFound("Order not found");

    if (order.buyerId !== user.id && order.sellerId !== user.id && !user.isAdmin) {
      throw forbidden("You do not have access to this deliverable");
    }
    if (!canDownloadDelivery(user, order)) {
      throw forbidden("The original file unlocks when you accept the delivery.");
    }

    const result = await getDeliveryDownloadUrl(decodedKey, delivery.fileName);
    return reply.send(result);
  });

  // Watermarked preview of an image delivery (DEL-06), streamed through the API so the raw
  // storage URL is never exposed. Order participants and admins only.
  fastify.get("/deliveries/:id/preview", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };

    const [row] = await db
      .select({ previewKey: deliveries.previewKey, buyerId: orders.buyerId, sellerId: orders.sellerId })
      .from(deliveries)
      .innerJoin(orders, eq(orders.id, deliveries.orderId))
      .where(eq(deliveries.id, id))
      .limit(1);
    if (!row || !row.previewKey) throw notFound("Preview not found");
    if (row.buyerId !== user.id && row.sellerId !== user.id && !user.isAdmin) {
      throw forbidden("You do not have access to this preview");
    }

    const { body, contentType } = await getPrivateObject(row.previewKey);
    return reply
      .header("Content-Type", contentType)
      .header("Cache-Control", "private, max-age=300")
      .header("X-Content-Type-Options", "nosniff")
      .send(body);
  });
}
