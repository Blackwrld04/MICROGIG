"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { formatDateTime } from "@/lib/time";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";
import { ID_DOCUMENT_LABELS } from "@/modules/seller/contracts";
import type { VerificationRequest } from "@/mocks/account";

/** One-click approve / reject of seller ID stubs — SEL-02, §19 risk #5. Real mode: PATCH /api/v1/admin/verifications/:id. */
export function VerificationQueue() {
  const queryClient = useQueryClient();
  const { data: queue = [] } = useQuery(queries.verifications());

  const decision = useMutation({
    mutationFn: async ({ v, approved }: { v: VerificationRequest; approved: boolean }) => {
      if (!USE_MOCKS) await api(`/admin/verifications/${v.id}`, { method: "PATCH", body: { status: approved ? "APPROVED" : "REJECTED" } });
      return { v, approved };
    },
    onSuccess: ({ v, approved }) => {
      queryClient.setQueryData<VerificationRequest[]>(queryKeys.verifications, (q) => q?.filter((x) => x.id !== v.id));
      toast(approved ? `${v.sellerName} approved. The “Verified” badge is now active.` : `${v.sellerName} rejected.`);
    },
    onError: () => toast("That decision was not saved. Please try again.", "danger"),
  });

  function decide(v: VerificationRequest, approved: boolean) {
    decision.mutate({ v, approved });
  }

  return (
    <div className="space-y-4">
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
