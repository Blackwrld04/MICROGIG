"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/time";
import type { SessionRow } from "@/mocks/account";

/**
 * Active sessions + remote logout — AUTH-08.
 * TODO: DELETE /api/v1/me/sessions/:id and POST /api/v1/auth/logout-all.
 */
export function SessionList({ initial }: { initial: SessionRow[] }) {
  const [sessions, setSessions] = useState(initial);
  const [notice, setNotice] = useState("");
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
                onClick={() => {
                  setSessions((all) => all.filter((x) => x.id !== s.id));
                  setNotice(`Signed out of ${s.userAgent}.`);
                }}
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
        onClick={() => {
          setSessions((all) => all.filter((s) => s.current));
          setNotice("Signed out of all other devices.");
        }}
      >
        Log out everywhere else
      </Button>
      <p aria-live="polite" className="sr-only">
        {notice}
      </p>
      {notice ? <Alert variant="success">{notice}</Alert> : null}
    </div>
  );
}
