import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";

export const metadata: Metadata = { title: "Notification preferences" };

/** Notification preferences — NOT-02. */
export default async function NotificationSettingsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.notificationPrefs(), queryFn: () => serverData.notificationPrefs() });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose which emails you get. In-app alerts for your orders are always on.</p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <NotificationPrefsForm />
      </HydrationBoundary>
    </div>
  );
}
