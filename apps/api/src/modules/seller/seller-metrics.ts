import { sql } from "drizzle-orm";
import { db } from "../../db/connection.js";

export interface SellerMetrics {
  /** Average hours between a buyer's message and the seller's next reply; null with no replies yet. */
  avgResponseHours: number | null;
  lastDeliveryAt: string | null;
  /** Completed ÷ (completed + cancelled) orders, as a percentage; null with no finished orders. */
  completionRate: number | null;
  /** Orders whose first delivery met the original deadline, as a percentage; null with no deliveries. */
  onTimeDeliveryRate: number | null;
  /** Average price of completed orders; null with none. */
  avgSellingPriceCents: number | null;
  /** Everything ever credited to the seller from orders (before clearing), from the ledger. */
  netEarningsCents: number;
}

/** SEL-03 / Seller Analytics: computed from orders, deliveries, messages and the ledger. */
export async function getSellerMetrics(sellerUserId: string): Promise<SellerMetrics> {
  const [row] = (await db.execute(sql`
    WITH seller_orders AS (
      SELECT id, status, price_cents, deadline FROM orders WHERE seller_id = ${sellerUserId}
    ),
    first_deliveries AS (
      SELECT d.order_id, MIN(d.created_at) AS first_at
      FROM deliveries d JOIN seller_orders o ON o.id = d.order_id
      GROUP BY d.order_id
    ),
    replies AS (
      SELECT EXTRACT(EPOCH FROM (
        SELECT MIN(r.created_at) FROM messages r
        WHERE r.order_id = m.order_id AND r.sender_role = 'seller' AND r.created_at > m.created_at
      ) - m.created_at) / 3600.0 AS hours
      FROM messages m JOIN seller_orders o ON o.id = m.order_id
      WHERE m.sender_role = 'buyer'
    )
    SELECT
      (SELECT AVG(hours) FROM replies WHERE hours IS NOT NULL)                         AS avg_response_hours,
      (SELECT MAX(d.created_at) FROM deliveries d JOIN seller_orders o ON o.id = d.order_id) AS last_delivery_at,
      (SELECT COUNT(*) FILTER (WHERE status = 'COMPLETED') FROM seller_orders)        AS completed,
      (SELECT COUNT(*) FILTER (WHERE status = 'CANCELLED') FROM seller_orders)        AS cancelled,
      (SELECT COUNT(*) FROM first_deliveries)                                          AS delivered,
      (SELECT COUNT(*) FROM first_deliveries f JOIN seller_orders o ON o.id = f.order_id
         WHERE o.deadline IS NOT NULL AND f.first_at <= o.deadline)                    AS on_time,
      (SELECT AVG(price_cents) FROM seller_orders WHERE status = 'COMPLETED')         AS avg_price,
      (SELECT COALESCE(SUM(le.amount_cents), 0) FROM ledger_entries le
         JOIN ledger_accounts la ON la.id = le.account_id
         WHERE la.user_id = ${sellerUserId} AND la.kind = 'USER_PENDING' AND le.amount_cents > 0) AS net_earnings
  `)) as unknown as Array<Record<string, string | number | Date | null>>;

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const completed = num(row?.completed) ?? 0;
  const cancelled = num(row?.cancelled) ?? 0;
  const delivered = num(row?.delivered) ?? 0;
  const onTime = num(row?.on_time) ?? 0;
  const avgHours = num(row?.avg_response_hours);
  const avgPrice = num(row?.avg_price);
  const last = row?.last_delivery_at;

  return {
    avgResponseHours: avgHours === null ? null : Math.max(1, Math.round(avgHours)),
    lastDeliveryAt: last ? new Date(last as string).toISOString() : null,
    completionRate: completed + cancelled > 0 ? Math.round((completed / (completed + cancelled)) * 100) : null,
    onTimeDeliveryRate: delivered > 0 ? Math.round((onTime / delivered) * 1000) / 10 : null,
    avgSellingPriceCents: avgPrice === null ? null : Math.round(avgPrice),
    netEarningsCents: num(row?.net_earnings) ?? 0,
  };
}
