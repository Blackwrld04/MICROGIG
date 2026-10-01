import type { OrderStatus } from "@/lib/constants/order-status";

export type ViewerRole = "buyer" | "seller";

export interface OrderDelivery {
  id: string;
  sequenceNo: number;
  fileName: string;
  fileSize: number;
  sha256: string;
  /** image → watermarked preview (DEL-06); archive/document → metadata + tree only (DEL-07). */
  kind: "image" | "archive" | "document";
  fileTree: string[] | null;
  notes: string;
  createdAt: string;
}

export interface OrderMessage {
  id: string;
  senderRole: ViewerRole;
  senderName: string;
  body: string;
  attachmentName: string | null;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  label: string;
  actor: string;
  detail: string | null;
  createdAt: string;
}

/** Order workspace payload (GET /api/v1/orders/:id, shaped for the viewer). */
export interface OrderDetail {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  viewerRole: ViewerRole;
  gig: { slug: string; title: string };
  buyer: { name: string };
  seller: { name: string };
  priceCents: number;
  feeRateBps: number;
  revisionsIncluded: number;
  revisionsUsed: number;
  turnaroundHours: 24 | 48;
  requirementsPrompt: string[];
  requirementsAnswers: string[] | null;
  createdAt: string;
  deadline: string | null;
  revisionDeadline: string | null;
  autoCompleteAt: string | null;
  completedAt: string | null;
  disputedAt: string | null;
  mutualCancelRequestedBy: ViewerRole | null;
  isStarred: boolean;
  review: { rating: number; body: string | null } | null;
  deliveries: OrderDelivery[];
  messages: OrderMessage[];
  events: OrderEvent[];
}
