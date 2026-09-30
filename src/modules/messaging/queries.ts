import "server-only";
import { buildMockOrders } from "@/mocks/orders";
import { AVATAR_BY_NAME } from "@/mocks/people";
import type { OrderDetail, OrderMessage, ViewerRole } from "@/modules/orders/types";

export interface InboxThread {
  orderId: string;
  orderNumber: number;
  gigTitle: string;
  status: OrderDetail["status"];
  viewerRole: ViewerRole;
  viewerName: string;
  counterpartyName: string;
  counterpartyAvatar: string | null;
  messages: OrderMessage[];
  unreadCount: number;
  starred: boolean;
  archived: boolean;
  lastActivityAt: string;
}

/**
 * Inbox threads — MSG-02. One thread per order (MSG-01 is order-scoped).
 * TODO(messaging owner): real query with per-user read/star/archive state.
 */
export async function listThreads(nowMs: number): Promise<InboxThread[]> {
  return buildMockOrders(nowMs)
    .map((o) => {
      const viewerName = o.viewerRole === "buyer" ? o.buyer.name : o.seller.name;
      const counterpartyName = o.viewerRole === "buyer" ? o.seller.name : o.buyer.name;
      const last = o.messages.at(-1);
      // Demo: a counterparty message from the last 24h counts as unread.
      const unreadCount = o.messages.filter(
        (m) => m.senderRole !== o.viewerRole && nowMs - new Date(m.createdAt).getTime() < 24 * 60 * 60 * 1000,
      ).length;
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        gigTitle: o.gig.title,
        status: o.status,
        viewerRole: o.viewerRole,
        viewerName,
        counterpartyName,
        counterpartyAvatar: AVATAR_BY_NAME[counterpartyName] || null,
        messages: o.messages,
        unreadCount,
        starred: o.isStarred,
        archived: o.status === "CANCELLED",
        lastActivityAt: last?.createdAt ?? o.createdAt,
      };
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}
