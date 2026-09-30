import type { Metadata } from "next";
import { Inbox } from "@/components/messaging/inbox";
import { requireUser } from "@/modules/auth/session";
import { listThreads } from "@/modules/messaging/queries";
import { roleFor } from "@/modules/orders/queries";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

/** Messaging inbox — MSG-02. `?thread=<orderId>` opens a conversation directly. */
export default async function InboxPage({ searchParams }: { searchParams: { thread?: string } }) {
  const user = await requireUser({ next: "/inbox" });
  const now = Date.now();
  const threads = await listThreads(roleFor(user.accountType), now);
  const initialThreadId = threads.some((t) => t.orderId === searchParams.thread) ? searchParams.thread : undefined;
  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">Inbox</h1>
      <Inbox initial={threads} initialThreadId={initialThreadId} serverNow={now} />
    </div>
  );
}
