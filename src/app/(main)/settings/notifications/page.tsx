import type { Metadata } from "next";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";

export const metadata: Metadata = { title: "Notification preferences" };

/** Notification preferences — NOT-02. Defaults follow Appendix B NotificationPref. */
export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose which emails you get. In-app alerts for your orders are always on.</p>
      </div>
      <NotificationPrefsForm initial={{ orderEmail: true, inboxEmail: true, promoEmail: false }} />
    </div>
  );
}
