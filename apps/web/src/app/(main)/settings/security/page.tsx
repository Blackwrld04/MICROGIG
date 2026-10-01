import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { SessionList } from "@/components/settings/session-list";

export const metadata: Metadata = { title: "Security" };

/** Account security — AUTH-08 session management & remote logout. */
export default async function SecuritySettingsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.sessions(), queryFn: () => serverData.sessions() });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These devices are signed in to your account. Sign out of any you don&apos;t recognise.
        </p>
      </div>
      <section aria-labelledby="sessions-heading" className="space-y-3">
        <h2 id="sessions-heading" className="text-lg font-semibold">
          Active sessions
        </h2>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SessionList />
        </HydrationBoundary>
      </section>
    </div>
  );
}
