import "server-only";
import type { OrderTab } from "@/lib/constants/order-status";
import { isLate } from "@/lib/time";
import { buildMockOrders } from "@/mocks/orders";
import { inTab, tabCounts } from "./tabs";
import type { AccountType, Me } from "@/modules/auth/contracts";
import type { OrderDetail, ViewerRole } from "./types";

/*
 * Order reads for Server Components.
 * TODO(orders owner): replace fixtures with Prisma queries + assertOrderParticipant (§13.3).
 */

export interface OrderRow {
  id: string;
  orderNumber: number;
  gigTitle: string;
  counterpartyName: string;
  status: OrderDetail["status"];
  priceCents: number;
  dueAt: string | null;
  isLate: boolean;
  lateRemedyAvailable: boolean;
  isStarred: boolean;
}

export async function listOrders(role: ViewerRole, tab: OrderTab, search: string | undefined, nowMs: number) {
  const mine = buildMockOrders(nowMs).filter((o) => o.viewerRole === role);
  const term = search?.trim().toLowerCase();
  const searched = term
    ? mine.filter((o) => o.gig.title.toLowerCase().includes(term) || String(o.orderNumber).includes(term))
    : mine;

  const rows: OrderRow[] = searched
    .filter((o) => inTab(o, tab, nowMs))
    .map((o) => {
      const dueAt = o.status === "IN_REVISION" ? o.revisionDeadline : o.status === "DELIVERED" ? o.autoCompleteAt : o.deadline;
      const late = isLate(o, nowMs);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        gigTitle: o.gig.title,
        counterpartyName: role === "buyer" ? o.seller.name : o.buyer.name,
        status: o.status,
        priceCents: o.priceCents,
        dueAt: ["COMPLETED", "CANCELLED", "DISPUTED", "PENDING_REQUIREMENTS"].includes(o.status) ? null : dueAt,
        isLate: late,
        lateRemedyAvailable: late && dueAt !== null && nowMs > new Date(dueAt).getTime() + 24 * 60 * 60 * 1000,
        isStarred: o.isStarred,
      };
    });

  return { counts: tabCounts(mine, nowMs), orders: rows };
}

/** Account type → the side of an order that account can be on. */
export function roleFor(accountType: AccountType): ViewerRole {
  return accountType === "FREELANCER" ? "seller" : "buyer";
}

/**
 * Order workspace read with object-level authorization (§13.3): participants see their
 * own orders; admins can read any order (read-only). Everyone else gets null → 404.
 */
export async function getOrder(id: string, viewer: Me, nowMs: number): Promise<{ order: OrderDetail; readOnly: boolean } | null> {
  const order = buildMockOrders(nowMs).find((o) => o.id === id);
  if (!order) return null;
  if (order.viewerRole === roleFor(viewer.accountType) && !viewer.isAdmin) return { order, readOnly: false };
  if (viewer.isAdmin) return { order, readOnly: true };
  return null;
}

/** Orders awaiting admin arbitration (ORD-14). */
export async function listDisputedOrders(nowMs: number): Promise<OrderDetail[]> {
  return buildMockOrders(nowMs).filter((o) => o.status === "DISPUTED");
}
