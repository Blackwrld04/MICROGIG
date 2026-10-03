import { db } from "../../db/connection.js";
import { notifications, notificationPrefs } from "../../db/schema/index.js";
import { eq, desc } from "drizzle-orm";

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
