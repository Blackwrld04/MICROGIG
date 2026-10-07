import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  searchGigs,
  getGigBySlug,
  createGig,
  getMoreFromSeller,
  toggleGigFavorite,
  updateGig,
} from "./catalog.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { notFound, unprocessable } from "../../errors.js";
import { GIG_MAX_PRICE_CENTS, GIG_MIN_PRICE_CENTS } from "../../lib/money.js";

const createGigBody = z.object({
  title: z
    .string()
    .trim()
    .max(80, "Max 80 characters")
    .refine((t) => t.startsWith("I will "), 'Title must start with "I will…"'),
  category:           z.string().min(1, "Choose a category"),
  subcategory:        z.string().min(1, "Choose a subcategory"),
  description:        z.string().trim().min(1, "Add a description"),
  priceCents:         z.number().int().min(GIG_MIN_PRICE_CENTS).max(GIG_MAX_PRICE_CENTS),
  turnaroundHours:    z.union([z.literal(24), z.literal(48)]),
  revisionsIncluded:  z.number().int().min(0).max(5).default(2),
  tags:               z.array(z.string().trim().min(1).max(30)).max(5),
  faqs:               z.array(
    z.object({
      question: z.string().trim().min(1).max(150),
      answer:   z.string().trim().min(1).max(600),
    }),
  ).max(5),
  requirementsPrompt: z.array(z.string().trim().min(1)).min(1).max(3),
  images:             z.array(z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), "Images must use https")).max(10).optional(),
});

// PUT /gigs/:id: any subset of the create fields, plus pausing/publishing.
const updateGigBody = createGigBody
  .partial()
  .extend({ status: z.enum(["PUBLISHED", "PAUSED"]).optional() })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export async function catalogRoutes(fastify: FastifyInstance) {
  fastify.get("/gigs", async (req, reply) => {
    const q = req.query as {
      category?: string;
      subcategory?: string;
      search?: string;
      sort?: "price_asc" | "price_desc" | "rating_desc" | "delivery_time_asc";
      page?: string;
    };

    const result = await searchGigs({
      category:    q.category,
      subcategory: q.subcategory,
      search:      q.search,
      sort:        q.sort,
      page:        q.page ? Number(q.page) : 1,
    });

    return reply.send(result);
  });

  fastify.get("/gigs/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const gig = await getGigBySlug(slug, req.user);
    if (!gig) throw notFound("Gig not found");
    return reply.send(gig);
  });

  fastify.post("/gigs", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    const parsed = createGigBody.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid"]),
      );
      throw unprocessable("Validation failed", fieldErrors);
    }

    const created = await createGig(user.id, parsed.data);
    return reply.status(201).send(created);
  });

  fastify.get("/gigs/:id/more-from-seller", async (req, reply) => {
    const { id } = req.params as { id: string };
    const gigs = await getMoreFromSeller(id);
    return reply.send({ gigs });
  });

  fastify.post("/gigs/:id/favorite", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const res = await toggleGigFavorite(user.id, id);
    return reply.send(res);
  });

  fastify.put("/gigs/:id", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    const { id } = req.params as { id: string };
    const parsed = updateGigBody.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid"]),
      );
      throw unprocessable(parsed.error.flatten().formErrors[0] ?? "Validation failed", fieldErrors);
    }
    const updated = await updateGig(user.id, id, parsed.data);
    return reply.send(updated);
  });
}
