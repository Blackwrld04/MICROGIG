const H = 60 * 60 * 1000;
const D = 24 * H;

export type LedgerEntryType =
  | "TOP_UP"
  | "ORDER_PLACED"
  | "ORDER_COMPLETED"
  | "CLEARING"
  | "ORDER_REFUNDED"
  | "WITHDRAWAL"
  | "DISPUTE_ADJUSTMENT";

export interface WalletActivity {
  txnId: string;
  createdAt: string;
  description: string;
  type: LedgerEntryType;
  amountCents: number;
  balanceCents: number;
}

/** USER_AVAILABLE activity for the demo account, oldest first; running balance computed. */
export function mockWalletActivity(accountType: "CLIENT" | "FREELANCER", now: number): WalletActivity[] {
  const raw: Omit<WalletActivity, "balanceCents">[] =
    accountType === "CLIENT"
      ? [
          { txnId: "txn_8801", createdAt: iso(now - 10 * D), description: "Virtual wallet top-up", type: "TOP_UP", amountCents: 10000 },
          { txnId: "txn_8842", createdAt: iso(now - 3 * D), description: "Order #84890 escrow lock", type: "ORDER_PLACED", amountCents: -1500 },
          { txnId: "txn_8843", createdAt: iso(now - 3 * D + H), description: "Order #84920 escrow lock", type: "ORDER_PLACED", amountCents: -3500 },
          { txnId: "txn_8874", createdAt: iso(now - 2 * D), description: "Virtual wallet top-up", type: "TOP_UP", amountCents: 5000 },
          { txnId: "txn_8880", createdAt: iso(now - 51 * H), description: "Order #84918 escrow lock", type: "ORDER_PLACED", amountCents: -1500 },
          { txnId: "txn_8950", createdAt: iso(now - 5 * 60 * 1000), description: "Order #84931 escrow lock", type: "ORDER_PLACED", amountCents: -3500 },
        ]
      : [
          { txnId: "txn_8702", createdAt: iso(now - 12 * D), description: "Order #84850 funds cleared", type: "CLEARING", amountCents: 2800 },
          { txnId: "txn_8755", createdAt: iso(now - 8 * D), description: "Order #84862 funds cleared", type: "CLEARING", amountCents: 2000 },
          { txnId: "txn_8790", createdAt: iso(now - 6 * D), description: "Simulated payout", type: "WITHDRAWAL", amountCents: -3000 },
          { txnId: "txn_8921", createdAt: iso(now - 1 * D), description: "Order #84880 funds cleared", type: "CLEARING", amountCents: 2400 },
        ];
  let balance = 0;
  return raw.map((r) => ({ ...r, balanceCents: (balance += r.amountCents) }));
}

export const MOCK_PENDING_CENTS = 5600; // two completed orders in the 3-day clearing window
export const MOCK_LIFETIME_EARNINGS_CENTS = 87600;

export interface SessionRow {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  current: boolean;
}

export function mockSessions(now: number): SessionRow[] {
  return [
    { id: "sess-1", userAgent: "Chrome on Windows", ipAddress: "102.89.34.10", createdAt: iso(now - 2 * H), current: true },
    { id: "sess-2", userAgent: "Safari on iPhone", ipAddress: "102.89.34.11", createdAt: iso(now - 2 * D), current: false },
    { id: "sess-3", userAgent: "Firefox on macOS", ipAddress: "41.58.120.7", createdAt: iso(now - 5 * D), current: false },
  ];
}

export interface VerificationRequest {
  id: string;
  sellerName: string;
  email: string;
  country: string;
  idDocumentType: "PASSPORT" | "NATIONAL_ID" | "DRIVERS_LICENSE";
  documentReference: string;
  submittedAt: string;
}

export function mockVerifications(now: number): VerificationRequest[] {
  return [
    { id: "v1", sellerName: "Marcus Vance", email: "marcus@example.com", country: "United States", idDocumentType: "PASSPORT", documentReference: "P-55310982", submittedAt: iso(now - 6 * H) },
    { id: "v2", sellerName: "Dana Kim", email: "dana@example.com", country: "South Korea", idDocumentType: "NATIONAL_ID", documentReference: "NID-8841-2201", submittedAt: iso(now - 20 * H) },
    { id: "v3", sellerName: "Tom Reyes", email: "tom@example.com", country: "Philippines", idDocumentType: "DRIVERS_LICENSE", documentReference: "DL-N03-19-004512", submittedAt: iso(now - 2 * D) },
  ];
}

export interface NotificationItem {
  id: string;
  type:
    | "ORDER_PLACED"
    | "REQUIREMENTS_SUBMITTED"
    | "DELIVERABLE_UPLOADED"
    | "REVISION_REQUESTED"
    | "ORDER_COMPLETED"
    | "AUTO_COMPLETE_WARNING"
    | "LATE_WARNING"
    | "DISPUTE_OPENED"
    | "NEW_MESSAGE";
  orderId: string | null;
  message: string;
  createdAt: string;
  read: boolean;
}

export function mockNotifications(accountType: "CLIENT" | "FREELANCER", now: number): NotificationItem[] {
  if (accountType === "CLIENT") {
    return [
      { id: "n1", type: "DELIVERABLE_UPLOADED", orderId: "84920", message: "Sara Connor delivered order #84920", createdAt: iso(now - 20 * 60 * 1000), read: false },
      { id: "n6", type: "ORDER_PLACED", orderId: "84931", message: "Order #84931 is waiting for your requirements", createdAt: iso(now - 5 * 60 * 1000), read: false },
      { id: "n2", type: "LATE_WARNING", orderId: "84918", message: "Order #84918 is past its delivery deadline", createdAt: iso(now - 26 * H), read: false },
      { id: "n7", type: "ORDER_COMPLETED", orderId: "84890", message: "Order #84890 is complete. Leave a review?", createdAt: iso(now - 1 * D), read: true },
    ];
  }
  return [
    { id: "n8", type: "ORDER_PLACED", orderId: "84925", message: "New order #84925 from Priya Nair", createdAt: iso(now - 2 * H), read: false },
    { id: "n3", type: "REVISION_REQUESTED", orderId: "84912", message: "John Miller requested a revision on #84912", createdAt: iso(now - 14 * H), read: false },
    { id: "n4", type: "NEW_MESSAGE", orderId: "84925", message: "New message from Priya Nair on #84925", createdAt: iso(now - 90 * 60 * 1000), read: true },
    { id: "n5", type: "DISPUTE_OPENED", orderId: "84905", message: "Noah Park opened a dispute on #84905", createdAt: iso(now - 1 * D), read: true },
  ];
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}
