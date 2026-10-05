"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { formatDateTime } from "@/lib/time";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";
import type { SessionRow } from "@/mocks/account";

/**
 * Active sessions + remote logout — AUTH-08.
 */
export function SessionList() {
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useQuery(queries.sessions());

  const revoke = useMutation({
    mutationFn: async (target: SessionRow | "all") => {
      if (!USE_MOCKS) {
        // Revoke each other session; the backend's DELETE /me/sessions would also end this one.
        const ids = target === "all" ? sessions.filter((s) => !s.current).map((s) => s.id) : [target.id];
        await Promise.all(ids.map((id) => api(`/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" })));
      }
      return target;
    },
    onSuccess: (target) => {
      queryClient.setQueryData<SessionRow[]>(queryKeys.sessions, (all) =>
        all?.filter((s) => (target === "all" ? s.current : s.id !== target.id)),
      );
      toast(target === "all" ? "Signed out of all other devices." : `Signed out of ${target.userAgent}.`);
    },
    onError: () => toast("That session could not be signed out. Please try again.", "danger"),
  });
  const others = sessions.filter((s) => !s.current);

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <Monitor className="mt-0.5 h-5 w-5 text-heading" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-heading">
                  {s.userAgent}
                  {s.current ? (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">This device</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground">
                  IP {s.ipAddress} · Signed in {formatDateTime(s.createdAt)}
                </p>
              </div>
            </div>
            {!s.current ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => revoke.mutate(s)}
              >
                Sign out
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button
        variant="destructive"
        disabled={others.length === 0}
        onClick={() => revoke.mutate("all")}
      >
        Log out everywhere else
      </Button>
    </div>
  );
}
