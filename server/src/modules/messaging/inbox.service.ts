import { db } from "../../db/connection.js";
import { orders, gigs, users, messages, orderStars } from "../../db/schema/index.js";
import { eq, or, desc } from "drizzle-orm";
import type { AuthUser } from "../../types/auth.js";

export async function getInboxThreads(user: AuthUser) {
  const userOrders = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, buyerId: orders.buyerId, sellerId: orders.sellerId, gigTitle: gigs.title, createdAt: orders.createdAt })
    .from(orders)
    .innerJoin(gigs, eq(orders.gigId, gigs.id))
    .where(or(eq(orders.buyerId, user.id), eq(orders.sellerId, user.id)))
    .orderBy(desc(orders.createdAt));

  const stars      = await db.select({ orderId: orderStars.orderId }).from(orderStars).where(eq(orderStars.userId, user.id));
  const starredSet = new Set(stars.map((s) => s.orderId));

  const threads = await Promise.all(
    userOrders.map(async (o) => {
      const isBuyer         = o.buyerId === user.id;
      const viewerRole: "buyer" | "seller" = isBuyer ? "buyer" : "seller";
      const counterpartyId  = isBuyer ? o.sellerId : o.buyerId;

      const [counterparty] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, counterpartyId)).limit(1);

      const rawMessages = await db.select().from(messages).where(eq(messages.orderId, o.id)).orderBy(messages.createdAt);

      const threadMessages = rawMessages.map((m) => ({
        id:             m.id,
        senderRole:     m.senderRole as "buyer" | "seller",
        senderName:     m.senderRole === "buyer"
          ? (isBuyer ? user.fullName : (counterparty?.fullName ?? "Buyer"))
          : (!isBuyer ? user.fullName : (counterparty?.fullName ?? "Seller")),
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
        counterpartyName:   counterparty?.fullName ?? "User",
        counterpartyAvatar: null,
        messages:           threadMessages,
        unreadCount:        0,
        starred:            starredSet.has(o.id),
        archived:           o.status === "CANCELLED",
        lastActivityAt:     last?.createdAt ?? o.createdAt.toISOString(),
      };
    }),
  );

  return threads.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}
