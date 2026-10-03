import bcrypt from "bcryptjs";
import { db } from "../../db/connection.js";
import { users, sessions, ledgerAccounts, sellerProfiles } from "../../db/schema/index.js";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError } from "../../errors.js";
import type { AuthUser } from "../../types/auth.js";

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  accountType: "CLIENT" | "FREELANCER";
  userAgent?: string;
  ipAddress?: string;
}) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw new ApiError("An account with this email already exists.", 409, {
      email: "Email already in use",
    });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const userId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id:           userId,
      email:        input.email.toLowerCase(),
      passwordHash,
      fullName:     input.fullName,
      accountType:  input.accountType,
      isAdmin:      false,
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

export async function revokeSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
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
