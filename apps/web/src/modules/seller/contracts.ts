import { z } from "zod";

export const PROFICIENCIES = ["BASIC", "CONVERSATIONAL", "FLUENT", "NATIVE"] as const;
export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
export const ID_DOCUMENT_TYPES = ["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"] as const;

/** PUT /api/v1/me/seller-profile — SEL-01. */
export const sellerProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(80),
  headline: z.string().trim().min(1, "Enter a headline").max(80, "Max 80 characters"),
  about: z.string().trim().min(150, "At least 150 characters").max(600, "Max 600 characters"),
  country: z.string().trim().min(1, "Enter your country").max(60),
  languages: z
    .array(z.object({ language: z.string().trim().min(1, "Enter a language").max(60), proficiency: z.enum(PROFICIENCIES) }))
    .min(1, "Add at least one language"),
  skills: z
    .array(z.object({ skillName: z.string().trim().min(1, "Enter a skill").max(60), level: z.enum(SKILL_LEVELS) }))
    .min(1, "Add at least one skill"),
});
export type SellerProfileInput = z.infer<typeof sellerProfileSchema>;

/** POST /api/v1/me/seller-profile/submit — ID verification stub. */
export const idVerificationSchema = z.object({
  idDocumentType: z.enum(ID_DOCUMENT_TYPES),
  documentReference: z.string().trim().min(4, "Enter the document number").max(60),
});

export type VerificationStatus = "NOT_SUBMITTED" | "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";

export const PROFICIENCY_LABELS: Record<(typeof PROFICIENCIES)[number], string> = {
  BASIC: "Basic",
  CONVERSATIONAL: "Conversational",
  FLUENT: "Fluent",
  NATIVE: "Native",
};

export const SKILL_LEVEL_LABELS: Record<(typeof SKILL_LEVELS)[number], string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  EXPERT: "Expert",
};

export const ID_DOCUMENT_LABELS: Record<(typeof ID_DOCUMENT_TYPES)[number], string> = {
  PASSPORT: "Passport",
  NATIONAL_ID: "National ID card",
  DRIVERS_LICENSE: "Driver's license",
};
