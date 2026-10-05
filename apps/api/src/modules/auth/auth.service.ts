import bcrypt from "bcryptjs";
import { db } from "../../db/connection.js";
import { users, sessions, ledgerAccounts, sellerProfiles, emailVerifications } from "../../db/schema/index.js";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError } from "../../errors.js";
import { sendTransactionalEmail } from "../../lib/email.js";
import type { AuthUser } from "../../types/auth.js";

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function checkEmailAvailability(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return {
    exists: Boolean(existing),
    message: existing
      ? "This email has already been used before. Please sign in or use a different email."
      : "Email is available",
  };
}

export async function sendVerificationCode(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    throw new ApiError(
      "This email has already been used before. Please sign in or use a different email.",
      409,
      {
        email: "This email has already been used before. Please sign in or use a different email.",
      },
    );
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.transaction(async (tx) => {
    await tx.delete(emailVerifications).where(eq(emailVerifications.email, normalizedEmail));
    await tx.insert(emailVerifications).values({
      email: normalizedEmail,
      code,
      expiresAt,
    });
  });

  const subject = `Your MicroGig Confirmation Code: ${code}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 30px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e4e5e7; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <!-- MicroGig Logo Mark + Wordmark Lockup -->
          <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; display: inline-table;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 28px; height: 28px; border-collapse: collapse;">
                  <tr>
                    <td style="width: 8px; height: 8px; border-top: 3px solid #222325; border-left: 3px solid #222325; border-top-left-radius: 2px;"></td>
                    <td style="width: 12px; height: 8px; border-top: 3px solid #222325;"></td>
                    <td style="width: 8px; height: 8px;"></td>
                  </tr>
                  <tr>
                    <td style="width: 8px; height: 12px; border-left: 3px solid #222325;"></td>
                    <td align="center" valign="middle" style="width: 12px; height: 12px; padding: 0;">
                      <div style="width: 11px; height: 11px; background-color: #13A06F; border-radius: 2px;"></div>
                    </td>
                    <td style="width: 8px; height: 12px; border-right: 3px solid #222325;"></td>
                  </tr>
                  <tr>
                    <td style="width: 8px; height: 8px;"></td>
                    <td style="width: 12px; height: 8px; border-bottom: 3px solid #222325;"></td>
                    <td style="width: 8px; height: 8px; border-bottom: 3px solid #222325; border-right: 3px solid #222325; border-bottom-right-radius: 2px;"></td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align: middle;">
                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #222325; letter-spacing: -0.5px; text-transform: lowercase;">micro<span style="color: #13A06F;">gig</span></span>
              </td>
            </tr>
          </table>
          <h2 style="font-size: 20px; font-weight: 700; color: #222325; margin-top: 18px; margin-bottom: 8px;">Confirm Your Email</h2>
          <p style="font-size: 14px; color: #62646a; line-height: 1.5; margin: 0;">
            Use this 6-digit confirmation code to complete your signup:
          </p>
        </div>
        <div style="background: #f4f5f7; border: 2px dashed #1DBF73; border-radius: 8px; padding: 18px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #222325; margin-bottom: 20px;">
          ${code}
        </div>
        <p style="font-size: 13px; color: #62646a; line-height: 1.5; text-align: center; margin-bottom: 20px;">
          This code will expire in <strong>15 minutes</strong>. If you did not request this code, you can safely ignore this email.
        </p>
        <div style="font-size: 12px; color: #95979d; text-align: center; border-top: 1px solid #e4e5e7; padding-top: 16px;">
          &copy; ${new Date().getFullYear()} MicroGig Marketplace. All rights reserved.
        </div>
      </div>
    </div>
  `;
  const text = `Your MicroGig Confirmation Code is: ${code}\nThis code will expire in 15 minutes.`;

  await sendTransactionalEmail({
    to: normalizedEmail,
    subject,
    html,
    text,
  });

  return { ok: true, message: "Confirmation code sent to your email" };
}

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  accountType: "CLIENT" | "FREELANCER";
  code?: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const normalizedEmail = input.email.toLowerCase().trim();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new ApiError(
      "This email has already been used before. Please sign in or use a different email.",
      409,
      {
        email: "This email has already been used before. Please sign in or use a different email.",
      },
    );
  }

  // If a code was sent or code is provided, verify it (demo fallback: 123456)
  const [verificationRecord] = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.email, normalizedEmail))
    .limit(1);

  if (verificationRecord || input.code) {
    const isMasterCode = input.code === "123456";
    const matches = verificationRecord && verificationRecord.code === input.code?.trim() && verificationRecord.expiresAt >= new Date();

    if (!matches && !isMasterCode) {
      throw new ApiError(
        input.code ? "Invalid or expired confirmation code. Please check your email or request a new code." : "Please enter the confirmation code sent to your email.",
        422,
        { code: input.code ? "Invalid or expired confirmation code" : "Please enter the confirmation code" }
      );
    }

    if (verificationRecord) {
      await db.delete(emailVerifications).where(eq(emailVerifications.email, normalizedEmail));
    }
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const userId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id:           userId,
      email:        normalizedEmail,
      passwordHash,
      fullName:     input.fullName,
      accountType:  input.accountType,
      isAdmin:      false,
      emailVerified: true,
    });

    // Provision accounts based on role
    const kinds =
      input.accountType === "CLIENT"
        ? (["USER_AVAILABLE", "BUYER_FUNDING"] as const)
        : (["USER_AVAILABLE", "USER_PENDING"] as const);

    for (const kind of kinds) {
      await tx.insert(ledgerAccounts).values({
        userId,
        kind,
        balanceCents: 0,
      });
    }

    // If freelancer, create initial seller profile
    if (input.accountType === "FREELANCER") {
      await tx.insert(sellerProfiles).values({
        userId,
        displayName: input.fullName,
        headline:    "Freelance Specialist",
        about:       "",
        country:     "",
      });
    }
  });

  return createSession(userId, { userAgent: input.userAgent, ipAddress: input.ipAddress });
}

export async function loginUser(
  email: string,
  password: string,
  meta?: { userAgent?: string; ipAddress?: string },
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new ApiError("Invalid email or password.", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError("Invalid email or password.", 401);
  }

  return createSession(user.id, meta);
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string; ipAddress?: string },
) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    id:        sessionId,
    userId,
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
    expiresAt,
  });

  const user = await getUserById(userId);
  return { sessionId, user };
}

export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });

  return updated.length > 0;
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  for (const row of rows) {
    if (exceptSessionId && row.id === exceptSessionId) continue;
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, row.id));
  }
}

export async function getUserById(id: string): Promise<AuthUser> {
  const [user] = await db
    .select({
      id:          users.id,
      email:       users.email,
      fullName:    users.fullName,
      accountType: users.accountType,
      isAdmin:     users.isAdmin,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) throw new ApiError("User not found.", 404);

  return {
    ...user,
    isSeller:  user.accountType === "FREELANCER",
    sessionId: "",
  };
}

export async function listUserSessions(userId: string, currentSessionId: string) {
  const now = new Date();
  const rows = await db
    .select({
      id:        sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .orderBy(sessions.createdAt);

  return rows
    .filter((s) => s.expiresAt > now)
    .map((s) => ({
      id:        s.id,
      userAgent: s.userAgent ?? "Unknown device",
      ipAddress: s.ipAddress ?? "Unknown IP",
      createdAt: s.createdAt.toISOString(),
      current:   s.id === currentSessionId,
    }));
}
