import "server-only";
import { mockNotifications } from "@/mocks/account";

/** GET /api/v1/notifications — NOT-01/02. TODO(notifications owner): real query. */
export async function getNotifications(nowMs: number) {
  const notifications = mockNotifications(nowMs);
  return { unreadCount: notifications.filter((n) => !n.read).length, notifications };
}
