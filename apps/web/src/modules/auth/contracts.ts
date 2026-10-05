import { z } from "zod";

/**
 * Every account is EITHER a client (buys gigs) OR a freelancer (sells gigs), chosen at
 * sign-up and never switchable. This deliberately replaces PRD §3.1's "any user can also sell".
 */
export const ACCOUNT_TYPES = ["CLIENT", "FREELANCER"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** GET /api/v1/auth/me — AUTH-07 (+ accountType). `isSeller` is kept for AUTH-07 compatibility. */
export const meSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  accountType: z.enum(ACCOUNT_TYPES),
  isAdmin: z.boolean(),
  isSeller: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

/** AUTH-01: min 8 chars, 1 number, 1 symbol. */
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/\d/, "Include at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Include at least 1 symbol");

export const sendCodeSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
export type SendCodeInput = z.infer<typeof sendCodeSchema>;

/** POST /api/v1/auth/register */
export const registerSchema = z.object({
  accountType: z.enum(ACCOUNT_TYPES, { errorMap: () => ({ message: "Choose client or freelancer" }) }),
  email: z.string().email("Enter a valid email"),
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Enter your full name").max(120),
  code: z.string().trim().min(4, "Enter the confirmation code").max(10).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** POST /api/v1/auth/login */
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Where each kind of account lands after signing in. */
export function homeFor(user: Pick<Me, "accountType" | "isAdmin">): string {
  if (user.isAdmin) return "/admin/verifications";
  return user.accountType === "FREELANCER" ? "/seller/dashboard" : "/gigs";
}
