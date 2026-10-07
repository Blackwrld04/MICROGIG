import { db } from "../../db/connection.js";
import { orders, gigs, users, messages, orderStars, notifications } from "../../db/schema/index.js";
import { eq, or, desc, and, inArray, sql } from "drizzle-orm";
import type { AuthUser } from "../../types/auth.js";

/** One thread per order. Loaded with a fixed number of queries, however many orders there are. */
export async function getInboxThreads(user: AuthUser) {
  const userOrders = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, buyerId: orders.buyerId, sellerId: orders.sellerId, gigTitle: gigs.title, createdAt: orders.createdAt })
    .from(orders)
    .innerJoin(gigs, eq(orders.gigId, gigs.id))
    .where(or(eq(orders.buyerId, user.id), eq(orders.sellerId, user.id)))
    .orderBy(desc(orders.createdAt));
  if (userOrders.length === 0) return [];

  const orderIds = userOrders.map((o) => o.id);
  const counterpartyIds = [...new Set(userOrders.map((o) => (o.buyerId === user.id ? o.sellerId : o.buyerId)))];

  const [stars, people, allMessages, unread] = await Promise.all([
    db.select({ orderId: orderStars.orderId }).from(orderStars).where(eq(orderStars.userId, user.id)),
    db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, counterpartyIds)),
    db.select().from(messages).where(inArray(messages.orderId, orderIds)).orderBy(messages.createdAt),
    // Unread = this user's unread "new message" notifications for the order.
    db
      .select({ orderId: notifications.orderId, count: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.type, "NEW_MESSAGE"), eq(notifications.read, false), inArray(notifications.orderId, orderIds)))
      .groupBy(notifications.orderId),
  ]);

  const starredSet = new Set(stars.map((s) => s.orderId));
  const nameOf = new Map(people.map((p) => [p.id, p.fullName]));
  const unreadBy = new Map(unread.map((u) => [u.orderId, Number(u.count)]));
  const messagesBy = new Map<string, typeof allMessages>();
  for (const m of allMessages) messagesBy.set(m.orderId, [...(messagesBy.get(m.orderId) ?? []), m]);

  const threads = userOrders.map((o) => {
    const isBuyer = o.buyerId === user.id;
    const viewerRole: "buyer" | "seller" = isBuyer ? "buyer" : "seller";
    const counterpartyName = nameOf.get(isBuyer ? o.sellerId : o.buyerId) ?? "User";

    const threadMessages = (messagesBy.get(o.id) ?? []).map((m) => ({
      id:             m.id,
      senderRole:     m.senderRole as "buyer" | "seller",
      senderName:     m.senderRole === viewerRole ? user.fullName : counterpartyName,
      body:           m.body,
      attachmentName: m.attachmentName,
      createdAt:      m.createdAt.toISOString(),
    }));
    const last = threadMessages.at(-1);

    return {
      orderId:            o.id,
      orderNumber:        o.orderNumber,
      gigTitle:           o.gigTitle,
      status:             o.status,
      viewerRole,
      viewerName:         user.fullName,
      counterpartyName,
      counterpartyAvatar: null,
      messages:           threadMessages,
      unreadCount:        unreadBy.get(o.id) ?? 0,
      starred:            starredSet.has(o.id),
      archived:           o.status === "CANCELLED",
      lastActivityAt:     last?.createdAt ?? o.createdAt.toISOString(),
    };
  });

  return threads.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}
