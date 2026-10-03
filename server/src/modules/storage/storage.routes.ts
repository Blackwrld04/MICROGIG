import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createDeliveryPresignedUpload,
  createGalleryPresignedUpload,
  getDeliveryDownloadUrl,
} from "./storage.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { unprocessable } from "../../errors.js";

const presignDeliveryBody = z.object({
  filename:    z.string().min(1),
  contentType: z.string().min(1),
  fileSize:    z.number().int().min(1),
  orderId:     z.string().optional(),
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
    if (!parsed.success) throw unprocessable("Invalid upload request");

    const result = await createDeliveryPresignedUpload(user.id, parsed.data);
    return reply.send(result);
  });

  fastify.post("/uploads/presign", async (req, reply) => {
    const user = requireAuth(req);
    const parsed = presignUploadBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Invalid upload request");

    const result = await createGalleryPresignedUpload(user.id, parsed.data);
    return reply.send(result);
  });

  fastify.get("/deliveries/:fileKey/download", async (req, reply) => {
    requireAuth(req);
    const { fileKey } = req.params as { fileKey: string };
    const result = await getDeliveryDownloadUrl(fileKey);
    return reply.send(result);
  });
}
