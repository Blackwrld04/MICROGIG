"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/time";
import { ID_DOCUMENT_LABELS } from "@/modules/seller/contracts";
import type { VerificationRequest } from "@/mocks/account";

/** One-click approve / reject of seller ID stubs — SEL-02, §19 risk #5. TODO: admin endpoints (not yet in §12). */
export function VerificationQueue({ initial }: { initial: VerificationRequest[] }) {
  const [queue, setQueue] = useState(initial);
  const [notice, setNotice] = useState("");

  function decide(v: VerificationRequest, approved: boolean) {
    setQueue((q) => q.filter((x) => x.id !== v.id));
    setNotice(approved ? `${v.sellerName} approved. The “Verified” badge is now active.` : `${v.sellerName} rejected.`);
  }

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {notice}
      </p>
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          The verification queue is empty.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {queue.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="text-sm">
                <p className="font-semibold text-heading">{v.sellerName}</p>
                <p className="text-muted-foreground">
                  {v.email} · {v.country}
                </p>
                <p className="mt-1">
                  {ID_DOCUMENT_LABELS[v.idDocumentType]}: <span className="font-mono">{v.documentReference}</span>
                </p>
                <p className="text-xs text-muted-foreground">Submitted {formatDateTime(v.submittedAt)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => decide(v, false)} aria-label={`Reject ${v.sellerName}`}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => decide(v, true)} aria-label={`Approve ${v.sellerName}`}>
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
