import { db } from "../../db/connection.js";
import { notifications, notificationPrefs, users } from "../../db/schema/index.js";
import { eq, desc } from "drizzle-orm";
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

export async function createAndDispatchNotification(input: {
  userId: string;
  type: NotificationType;
  orderId?: string | null;
  message: string;
  actionUrl?: string;
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
    })
    .returning();

  // Async dispatch email without blocking DB flow
  setImmediate(async () => {
    try {
      const [user] = await db
        .select({ email: users.email, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) return;

      const prefs = await getNotificationPreferences(input.userId);
      const isInbox = input.type === "NEW_MESSAGE";
      const isOrder = !isInbox;

      if (isInbox && !prefs.inboxEmail) return;
      if (isOrder && !prefs.orderEmail) return;

      const actionLink = input.actionUrl
        ? input.actionUrl
        : input.orderId
          ? `${env.WEB_ORIGIN}/orders/${input.orderId}`
          : `${env.WEB_ORIGIN}/inbox`;

      const subjectMap: Record<string, string> = {
        ORDER_PLACED: "New order placed on microgig",
        REQUIREMENTS_SUBMITTED: "Requirements submitted for your order",
        DELIVERABLE_UPLOADED: "New delivery ready for your review",
        REVISION_REQUESTED: "Revision requested on your order",
        ORDER_COMPLETED: "Order completed & payment released",
        AUTO_COMPLETE_WARNING: "Order awaiting review - 24 hours remaining",
        LATE_WARNING: "Order delivery is approaching deadline",
        DISPUTE_OPENED: "A dispute has been opened on your order",
        NEW_MESSAGE: "New message on microgig",
      };

      const subject = subjectMap[input.type] || "New notification from microgig";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    <p>Hi ${escapeHtml(user.fullName)},</p>
    <div class="message">${escapeHtml(input.message)}</div>
    <div>
      <a href="${actionLink}" class="btn">View on microgig</a>
    </div>
    <div class="footer">
      You received this because of your notification settings on microgig. Manage your preferences in your account settings.
    </div>
  </div>
</body>
</html>`;

      await sendTransactionalEmail({
        to: user.email,
        subject,
        html,
        text: `${input.message}\n\nView details: ${actionLink}`,
      });
    } catch (err) {
      console.error("[Notification Dispatch Error]:", err);
    }
  });

  return created;
}
