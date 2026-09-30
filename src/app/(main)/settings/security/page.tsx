import type { Metadata } from "next";
import { SessionList } from "@/components/settings/session-list";
import { listSessions } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Security" };

/** Account security — AUTH-08 session management & remote logout. */
export default async function SecuritySettingsPage() {
  const sessions = await listSessions(Date.now());
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
        <SessionList initial={sessions} />
      </section>
    </div>
  );
}
