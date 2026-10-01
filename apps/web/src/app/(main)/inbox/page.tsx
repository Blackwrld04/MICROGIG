import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Inbox } from "@/components/messaging/inbox";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

/** Messaging inbox — MSG-02. `?thread=<orderId>` opens a conversation directly. */
export default async function InboxPage({ searchParams }: { searchParams: { thread?: string } }) {
  await requireUser({ next: "/inbox" });
  const queryClient = getQueryClient();
  const threads = await queryClient.fetchQuery({ ...queries.inbox(), queryFn: () => serverData.inbox() });
  const initialThreadId = threads.some((t) => t.orderId === searchParams.thread) ? searchParams.thread : undefined;
  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">Inbox</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Inbox initialThreadId={initialThreadId} serverNow={Date.now()} />
      </HydrationBoundary>
    </div>
  );
}
