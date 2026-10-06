"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";

type Prefs = { orderEmail: boolean; inboxEmail: boolean; promoEmail: boolean };

const ROWS: { key: keyof Prefs; label: string; description: string; inApp: "always" | "yes" | "no" }[] = [
  { key: "orderEmail", label: "Orders", description: "Placed, requirements, deliveries, revisions, completion, late and auto-complete warnings, disputes", inApp: "always" },
  { key: "inboxEmail", label: "Messages", description: "New messages on your orders", inApp: "always" },
  { key: "promoEmail", label: "Promotions", description: "Tips and product news", inApp: "no" },
];

/**
 * Notification preference matrix — NOT-02 (NotificationPref: orderEmail, inboxEmail, promoEmail).
 * In-app alerts for critical order events are always on.
 * Real mode: GET / PUT /api/v1/notification-prefs.
 */
export function NotificationPrefsForm() {
  const { data } = useQuery(queries.notificationPrefs());
  if (!data) return null;
  return <PrefsEditor initial={data} />;
}

function PrefsEditor({ initial }: { initial: Prefs }) {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async (next: Prefs) => {
      if (!USE_MOCKS) await api("/notification-prefs", { method: "PUT", body: next });
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.notificationPrefs, next);
      setSaved(true);
      toast("Preferences saved.");
    },
    onError: () => toast("Your preferences were not saved. Please try again.", "danger"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(prefs);
      }}
      className="space-y-4"
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Notification channels by category</caption>
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">In-app</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block font-semibold text-heading">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.description}</span>
                </th>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                  {r.inApp === "always" ? "Always on" : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    aria-label={`Email me about ${r.label.toLowerCase()}`}
                    checked={prefs[r.key]}
                    onChange={(e) => {
                      setPrefs((p) => ({ ...p, [r.key]: e.target.checked }));
                      setSaved(false);
                    }}
                    className="h-4 w-4 accent-heading"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">Save preferences</Button>
        <p aria-live="polite" className="text-sm font-semibold text-emerald-800">
          {saved ? "Preferences saved." : ""}
        </p>
      </div>
    </form>
  );
}
