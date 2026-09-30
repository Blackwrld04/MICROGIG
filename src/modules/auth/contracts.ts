import { z } from "zod";

/** GET /api/v1/auth/me — AUTH-07 */
export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
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

/** POST /api/v1/auth/register */
export const registerSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Enter your full name").max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** POST /api/v1/auth/login */
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;
