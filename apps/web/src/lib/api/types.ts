/**
 * Response shapes of the /api/v1 endpoints the frontend calls. Type-only imports, so this
 * file is safe in client components (nothing server-only ends up in the bundle).
 */
import type { GigCard, GigDetail, GigSearchResult } from "@/modules/catalog/contracts";
import type { ClientWalletSummary, WalletSummary } from "@/modules/ledger/contracts";
import type { InboxThread } from "@/modules/messaging/queries";
import type { OrderRow } from "@/modules/orders/queries";
import type { OrderDetail } from "@/modules/orders/types";
import type { getSellerDashboard, getMySellerProfile } from "@/modules/seller/queries";
import type { getSellerPublicPage } from "@/modules/catalog/queries";
import type { NotificationItem, SessionRow, VerificationRequest, WalletActivity } from "@/mocks/account";
import type { OrderTab } from "@/lib/constants/order-status";

export type { GigCard, GigDetail, GigSearchResult, InboxThread, OrderRow, OrderDetail, NotificationItem, SessionRow, VerificationRequest, WalletActivity };

export type SellerPageResponse = NonNullable<Awaited<ReturnType<typeof getSellerPublicPage>>>;
export type OrderListResponse = { counts: Record<OrderTab, number>; orders: OrderRow[] };
export type OrderResponse = { order: OrderDetail; readOnly: boolean };
export type NotificationsResponse = { unreadCount: number; notifications: NotificationItem[] };
export type WalletResponse =
  | { accountType: "CLIENT"; summary: ClientWalletSummary; activity: WalletActivity[] }
  | { accountType: "FREELANCER"; summary: WalletSummary; activity: WalletActivity[] };
export type DashboardResponse = Awaited<ReturnType<typeof getSellerDashboard>>;
export type SellerProfileResponse = Awaited<ReturnType<typeof getMySellerProfile>>;
export type NotificationPrefs = { orderEmail: boolean; inboxEmail: boolean; promoEmail: boolean };
