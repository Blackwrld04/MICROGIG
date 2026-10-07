import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getSellerProfile,
  updateSellerProfile,
  submitVerification,
  getSellerDashboardData,
  getPublicSellerCard,
} from "./seller.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { notFound, unprocessable } from "../../errors.js";

const proficiencies = ["BASIC", "CONVERSATIONAL", "FLUENT", "NATIVE"] as const;
const skillLevels   = ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
const idDocTypes    = ["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"] as const;

const sellerProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(80),
  headline:    z.string().trim().min(1, "Enter a headline").max(80),
  about:       z.string().trim().min(150, "At least 150 characters").max(600),
  country:     z.string().trim().min(1, "Enter your country").max(60),
  languages:   z.array(z.object({ language: z.string().trim().min(1).max(60), proficiency: z.enum(proficiencies) })).min(1, "Add at least one language"),
  skills:      z.array(z.object({ skillName: z.string().trim().min(1).max(60), level: z.enum(skillLevels) })).min(1, "Add at least one skill"),
});

const idVerificationSchema = z.object({
  idDocumentType:    z.enum(idDocTypes),
  documentReference: z.string().trim().min(4).max(60),
});

export async function sellerRoutes(fastify: FastifyInstance) {
  fastify.get("/me/seller-profile", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    return reply.send(await getSellerProfile(user.id));
  });

  fastify.put("/me/seller-profile", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    const parsed = sellerProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid"]),
      );
      throw unprocessable("Validation failed", fieldErrors);
    }
    return reply.send(await updateSellerProfile(user.id, parsed.data));
  });

  fastify.post("/me/seller-profile/submit", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    const parsed = idVerificationSchema.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Invalid verification details");
    return reply.send(await submitVerification(user.id, parsed.data));
  });

  fastify.get("/me/dashboard", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    return reply.send(await getSellerDashboardData(user.id));
  });

  fastify.get("/sellers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await getPublicSellerCard(id, req.user);
    if (!data) throw notFound("Seller not found");
    return reply.send(data);
  });
}
