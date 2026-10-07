import bcrypt from "bcryptjs";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "../../db/connection.js";
import { users, sessions, ledgerAccounts, sellerProfiles, emailVerifications } from "../../db/schema/index.js";
import { eq, and, isNull, ne, sql } from "drizzle-orm";
import { ApiError } from "../../errors.js";
import { env } from "../../env.js";
import { sendTransactionalEmail } from "../../lib/email.js";
import type { AuthUser } from "../../types/auth.js";

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const CODE_TTL_MS             = 15 * 60 * 1000; // a code is valid for 15 minutes
const CODE_MAX_ATTEMPTS       = 5;              // wrong guesses before the code is burned
const CODE_RESEND_COOLDOWN_MS = 60 * 1000;      // one email per address per minute
const CODE_MAX_SENDS_PER_HOUR = 5;
const HOUR_MS                 = 60 * 60 * 1000;

const LOGIN_MAX_FAILURES = 5;                   // PRD 13.2: 5 failures lock the account
const LOGIN_LOCK_SECONDS = 15 * 60;             // for 15 minutes

// Compared against when the email is unknown, so a login takes the same time either way.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("microgig-timing-equaliser", BCRYPT_ROUNDS);

const GENERIC_SEND_MESSAGE = "If this email can be used, we've sent a 6-digit confirmation code to it.";
const INVALID_CODE_MESSAGE = "Invalid or expired confirmation code. Please check your email or request a new code.";

export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

/** Keyed on the email and COOKIE_SECRET so a leaked table can't be brute-forced offline. */
export function hashVerificationCode(email: string, code: string) {
  return createHash("sha256").update(`${env.COOKIE_SECRET}:${email}:${code}`).digest("hex");
}

function sameHash(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function codeEmailHtml(code: string) {
  return `
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
}

function existingAccountEmail() {
  const signIn = `${env.WEB_ORIGIN}/login`;
  return {
    subject: "You already have a microgig account",
    text: `Someone (hopefully you) tried to sign up to microgig with this email, but it already has an account.\nSign in instead: ${signIn}\nIf this wasn't you, you can ignore this email.`,
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #222325;">
  <h2 style="font-size: 20px;">You already have an account</h2>
  <p style="font-size: 14px; color: #62646a; line-height: 1.5;">Someone (hopefully you) tried to sign up to microgig with this email, but it already has an account.</p>
  <p><a href="${signIn}" style="color: #0E7A55; font-weight: 700;">Sign in instead</a></p>
  <p style="font-size: 12px; color: #62646a;">If this wasn't you, you can ignore this email.</p>
</div>`,
  };
}

/**
 * Emails a 6-digit confirmation code (AUTH-01). The response is the same whether or not the
 * email already has an account, so this can't be used to find out who is registered: an
 * existing account gets a "you already have an account" email instead of a code.
 */
export async function sendVerificationCode(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const now = new Date();

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  const [record] = await db.select().from(emailVerifications).where(eq(emailVerifications.email, email)).limit(1);

  const windowOpen = !!record && now.getTime() - record.windowStartedAt.getTime() < HOUR_MS;
  if (record) {
    const sinceLast = now.getTime() - record.lastSentAt.getTime();
    if (sinceLast < CODE_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((CODE_RESEND_COOLDOWN_MS - sinceLast) / 1000);
      throw new ApiError(`Please wait ${wait} seconds before requesting another code.`, 429);
    }
    if (windowOpen && record.sendCount >= CODE_MAX_SENDS_PER_HOUR) {
      throw new ApiError("Too many codes requested for this email. Try again in an hour.", 429);
    }
  }

  // Existing accounts still get a row (with a code nobody receives) so the throttle applies.
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = hashVerificationCode(email, code);
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

  await db
    .insert(emailVerifications)
    .values({ email, codeHash, attempts: 0, sendCount: 1, windowStartedAt: now, lastSentAt: now, expiresAt })
    .onConflictDoUpdate({
      target: emailVerifications.email,
      set: {
        codeHash,
        attempts: 0,
        expiresAt,
        lastSentAt: now,
        sendCount: windowOpen ? sql`${emailVerifications.sendCount} + 1` : 1,
        windowStartedAt: windowOpen ? record!.windowStartedAt : now,
      },
    });

  console.log(`[auth] Confirmation code generated for ${email}: ${code}`);

  const message = existingUser
    ? existingAccountEmail()
    : {
        subject: `Your microgig confirmation code: ${code}`,
        html: codeEmailHtml(code),
        text: `Your microgig confirmation code is: ${code}\nThis code will expire in 15 minutes.`,
      };

  const result = await sendTransactionalEmail({ to: email, ...message });
  if (result.status === "sent") return { ok: true, message: GENERIC_SEND_MESSAGE };

  // Development without a provider or simulation mode:
  if (
    (result.status === "not_configured" && env.NODE_ENV !== "production") ||
    env.ALLOW_SIMULATED_EMAIL
  ) {
    console.log(`[auth] ALLOW_SIMULATED_EMAIL is active. Code for ${email} is ${code}`);
    return { ok: true, message: GENERIC_SEND_MESSAGE };
  }

  // The code never reached the user: burn it so it can't be guessed.
  await db.update(emailVerifications).set({ expiresAt: now }).where(eq(emailVerifications.email, email));
  if (result.status === "not_configured") {
    throw new ApiError("Email delivery isn't set up yet, so we can't send confirmation codes right now.", 503);
  }
  console.error("[send-code] email delivery failed:", result.error);
  throw new ApiError("We couldn't send the confirmation email. Please try again in a moment.", 502);
}

/**
 * Checks a confirmation code and consumes it on success. Each guess counts toward
 * CODE_MAX_ATTEMPTS; after that the code is dead and a new one must be requested.
 */
export async function consumeVerificationCode(email: string, code: string | undefined) {
  if (!code?.trim()) {
    throw new ApiError("Please enter the confirmation code sent to your email.", 422, {
      code: "Please enter the confirmation code",
    });
  }

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the cap.
  const [record] = await db
    .update(emailVerifications)
    .set({ attempts: sql`${emailVerifications.attempts} + 1` })
    .where(
      and(
        eq(emailVerifications.email, email),
        sql`${emailVerifications.attempts} < ${CODE_MAX_ATTEMPTS}`,
        sql`${emailVerifications.expiresAt} > now()`,
      ),
    )
    .returning();

  if (!record || !sameHash(record.codeHash, hashVerificationCode(email, code.trim()))) {
    const exhausted = !record || record.attempts >= CODE_MAX_ATTEMPTS;
    throw new ApiError(
      exhausted ? "This code has expired or had too many wrong attempts. Request a new code." : INVALID_CODE_MESSAGE,
      422,
      { code: "Invalid or expired confirmation code" },
    );
  }

  await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
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
  const normalizedEmail = normalizeEmail(input.email);

  // The code proves the person owns the inbox. Existing accounts never receive a code,
  // so signing up over one fails here with the same error as a wrong code.
  await consumeVerificationCode(normalizedEmail, input.code);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    throw new ApiError("This email already has an account. Please sign in instead.", 409, {
      email: "This email already has an account",
    });
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
      emailVerified: true, // only reached after a matching code
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
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw new ApiError("Invalid email or password.", 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new ApiError(`Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    // The 5th failure in a row locks the account for 15 minutes and resets the counter.
    const reachesLimit = sql`${users.failedLoginCount} + 1 >= ${LOGIN_MAX_FAILURES}`;
    await db
      .update(users)
      .set({
        failedLoginCount: sql`CASE WHEN ${reachesLimit} THEN 0 ELSE ${users.failedLoginCount} + 1 END`,
        lockedUntil: sql`CASE WHEN ${reachesLimit} THEN now() + make_interval(secs => ${LOGIN_LOCK_SECONDS}) ELSE ${users.lockedUntil} END`,
      })
      .where(eq(users.id, user.id));
    throw new ApiError("Invalid email or password.", 401);
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
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
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });

  return updated.length > 0;
}

/** Revokes every live session of the user, optionally keeping the one making the request. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
      ),
    );
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
