import { db } from "../../db/connection.js";
import { notifications, notificationPrefs } from "../../db/schema/index.js";
import { eq, desc, sql } from "drizzle-orm";
import { sendTransactionalEmail } from "../../lib/email.js";
import { env } from "../../env.js";

type NotificationType = (typeof notifications.$inferInsert)["type"];

export async function getUserNotifications(userId: string) {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
  const formatted = rows.map((n) => ({ id: n.id, type: n.type, orderId: n.orderId, message: n.message, read: n.read, createdAt: n.createdAt.toISOString() }));
  return { unreadCount: formatted.filter((n) => !n.read).length, notifications: formatted };
}

export async function markNotificationsAsRead(userId: string) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  return { ok: true };
}

export async function getNotificationPreferences(userId: string) {
  const [pref] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId)).limit(1);
  if (!pref) return { orderEmail: true, inboxEmail: true, promoEmail: false };
  return { orderEmail: pref.orderEmail, inboxEmail: pref.inboxEmail, promoEmail: pref.promoEmail };
}

export async function updateNotificationPreferences(userId: string, input: { orderEmail?: boolean; inboxEmail?: boolean; promoEmail?: boolean }) {
  const [existing] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId)).limit(1);

  if (existing) {
    await db.update(notificationPrefs).set({
      orderEmail: input.orderEmail ?? existing.orderEmail,
      inboxEmail: input.inboxEmail ?? existing.inboxEmail,
      promoEmail: input.promoEmail ?? existing.promoEmail,
    }).where(eq(notificationPrefs.userId, userId));
  } else {
    await db.insert(notificationPrefs).values({ userId, orderEmail: input.orderEmail ?? true, inboxEmail: input.inboxEmail ?? true, promoEmail: input.promoEmail ?? false });
  }

  return getNotificationPreferences(userId);
}

const SUBJECTS: Record<NotificationType, string> = {
  ORDER_PLACED: "New order placed on microgig",
  REQUIREMENTS_SUBMITTED: "Requirements submitted for your order",
  DELIVERABLE_UPLOADED: "New delivery ready for your review",
  REVISION_REQUESTED: "Revision requested on your order",
  ORDER_COMPLETED: "Order completed & payment released",
  AUTO_COMPLETE_WARNING: "Order awaiting review - 24 hours remaining",
  LATE_WARNING: "Order delivery deadline update",
  DISPUTE_OPENED: "A dispute has been opened on your order",
  NEW_MESSAGE: "New message on microgig",
  REVIEW_REMINDER: "How did your order go? Leave a review",
  DISPUTE_RESOLVED: "Your dispute has been resolved",
  ORDER_CANCELLED: "Order cancellation update",
};

const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_BATCH_SIZE   = 25;
const EMAIL_LEASE_MS     = 10 * 60 * 1000; // a crashed sender's rows become claimable again after this

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Records an in-app notification and queues its email (outbox pattern). Pass `tx` to write it
 * in the caller's transaction: the email is only sent once that transaction has committed,
 * because the dispatcher can't see the row before then. `dedupeKey` makes repeated scheduled
 * warnings a no-op; the function then returns null.
 */
export async function createAndDispatchNotification(input: {
  userId: string;
  type: NotificationType;
  orderId?: string | null;
  message: string;
  dedupeKey?: string;
  tx?: any;
}) {
  const runner = input.tx ?? db;

  const [created] = await runner
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      orderId: input.orderId ?? null,
      message: input.message,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (created) scheduleEmailDispatch();
  return created ?? null;
}

let dispatchTimer: NodeJS.Timeout | null = null;

/** Sends queued emails shortly; the cron job is the fallback if this process dies first. */
export function scheduleEmailDispatch(delayMs = 1000) {
  if (dispatchTimer || env.NODE_ENV === "test") return;
  dispatchTimer = setTimeout(() => {
    dispatchTimer = null;
    dispatchPendingEmails().catch((err) => console.error("[Email dispatch]", err));
  }, delayMs);
  dispatchTimer.unref?.();
}

/**
 * Claims a batch of queued notification emails and sends them. Rows are leased with
 * FOR UPDATE SKIP LOCKED, so several API instances can run this at once without double-sending.
 * Failures retry with exponential backoff, up to EMAIL_MAX_ATTEMPTS.
 */
export async function dispatchPendingEmails(): Promise<{ sent: number; failed: number; skipped: number }> {
  const claimed = (await db.execute(sql`
    UPDATE notifications n
    SET email_status = 'SENDING',
        email_attempts = n.email_attempts + 1,
        email_next_attempt_at = now() + make_interval(secs => ${EMAIL_LEASE_MS / 1000})
    FROM users u
    WHERE n.user_id = u.id
      AND n.id IN (
        SELECT id FROM notifications
        WHERE email_status IN ('PENDING', 'SENDING')
          AND (email_next_attempt_at IS NULL OR email_next_attempt_at <= now())
        ORDER BY created_at
        LIMIT ${EMAIL_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
    RETURNING n.id, n.user_id, n.type, n.order_id, n.message, n.email_attempts, u.email, u.full_name
  `)) as unknown as Array<{
    id: string; user_id: string; type: NotificationType; order_id: string | null; message: string;
    email_attempts: number; email: string; full_name: string;
  }>;

  const counts = { sent: 0, failed: 0, skipped: 0 };
  for (const r of claimed) {
    const prefs = await getNotificationPreferences(r.user_id);
    const wanted = r.type === "NEW_MESSAGE" ? prefs.inboxEmail : prefs.orderEmail;
    if (!wanted) {
      await db.update(notifications).set({ emailStatus: "SKIPPED", emailNextAttemptAt: null }).where(eq(notifications.id, r.id));
      counts.skipped++;
      continue;
    }

    const result = await sendTransactionalEmail(
      renderNotificationEmail({ email: r.email, fullName: r.full_name, type: r.type, orderId: r.order_id, message: r.message }),
    );

    if (result.status === "sent") {
      await db.update(notifications).set({ emailStatus: "SENT", emailNextAttemptAt: null, emailLastError: null }).where(eq(notifications.id, r.id));
      counts.sent++;
    } else if (result.status === "not_configured") {
      // Nothing to retry against; the in-app notification still exists.
      await db.update(notifications).set({ emailStatus: "SKIPPED", emailNextAttemptAt: null, emailLastError: "No email provider configured" }).where(eq(notifications.id, r.id));
      counts.skipped++;
    } else {
      const giveUp = r.email_attempts >= EMAIL_MAX_ATTEMPTS;
      const backoffMs = 60_000 * 2 ** (r.email_attempts - 1); // 1, 2, 4, 8 minutes
      await db
        .update(notifications)
        .set({
          emailStatus: giveUp ? "FAILED" : "PENDING",
          emailNextAttemptAt: giveUp ? null : new Date(Date.now() + backoffMs),
          emailLastError: result.error.slice(0, 500),
        })
        .where(eq(notifications.id, r.id));
      counts.failed++;
    }
  }

  // A full batch means more may be waiting.
  if (claimed.length === EMAIL_BATCH_SIZE) scheduleEmailDispatch(0);
  return counts;
}

export function renderNotificationEmail(row: {
  email: string;
  fullName: string;
  type: NotificationType;
  orderId: string | null;
  message: string;
}) {
  const actionLink = row.orderId ? `${env.WEB_ORIGIN}/orders/${row.orderId}` : `${env.WEB_ORIGIN}/inbox`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; }
    .brand { font-size: 20px; font-weight: 700; color: #10b981; letter-spacing: -0.5px; margin-bottom: 24px; }
    .message { font-size: 16px; line-height: 1.6; color: #e4e4e7; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #10b981; color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-bottom: 24px; }
    .footer { font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">microgig</div>
    <p>Hi ${escapeHtml(row.fullName)},</p>
    <div class="message">${escapeHtml(row.message)}</div>
    <div>
      <a href="${escapeHtml(actionLink)}" class="btn">View on microgig</a>
    </div>
    <div class="footer">
      You received this because of your notification settings on microgig. Manage your preferences in your account settings.
    </div>
  </div>
</body>
</html>`;

  return {
    to: row.email,
    subject: SUBJECTS[row.type] ?? "New notification from microgig",
    html,
    text: `${row.message}\n\nView details: ${actionLink}`,
  };
}
