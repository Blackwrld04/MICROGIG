import "server-only";
import { mockNotifications } from "@/mocks/account";
import type { AccountType } from "@/modules/auth/contracts";

/** GET /api/v1/notifications — NOT-01/02. TODO(notifications owner): real query. */
export async function getNotifications(accountType: AccountType, nowMs: number) {
  const notifications = mockNotifications(accountType, nowMs);
  return { unreadCount: notifications.filter((n) => !n.read).length, notifications };
}
