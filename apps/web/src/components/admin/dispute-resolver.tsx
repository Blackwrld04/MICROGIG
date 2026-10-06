"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { formatCents, splitEscrow } from "@/lib/money";
import { queries } from "@/lib/query/queries";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";
import { formatDateTime } from "@/lib/time";
import type { OrderDetail } from "@/modules/orders/types";

type Outcome = "REFUND" | "RELEASE" | "SPLIT";

/** Backend ruling names: who the escrow goes to. */
const RULING: Record<Outcome, "BUYER" | "SELLER" | "SPLIT"> = { REFUND: "BUYER", RELEASE: "SELLER", SPLIT: "SPLIT" };

/**
 * Dispute arbitration — ORD-14, T-10 (release), T-11 (refund), T-12 (split).
 * Real mode: POST /api/v1/admin/disputes/:id/resolve.
 */
/** Admin dispute triage list — ORD-14. Server state via TanStack Query. */
export function DisputeList() {
  const { data: disputes = [] } = useQuery(queries.disputes());
  if (disputes.length === 0) {
    return <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No open disputes.</p>;
  }
  return (
    <div className="space-y-6">
      {disputes.map((o) => (
        <DisputeResolver key={o.id} order={o} />
      ))}
    </div>
  );
}

function DisputeResolver({ order }: { order: OrderDetail }) {
  const [outcome, setOutcome] = useState<Outcome>("SPLIT");
  const [buyerPercent, setBuyerPercent] = useState("50");
  const [notes, setNotes] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const dispute = [...order.events].reverse().find((e) => e.label === "Dispute opened");
  const pct = Number(buyerPercent);
  const bps = outcome === "REFUND" ? 10000 : outcome === "RELEASE" ? 0 : Math.round(pct * 100);
  const split = splitEscrow(order.priceCents, order.feeRateBps, Number.isFinite(bps) ? bps : 0);

  function resolve(e: React.FormEvent) {
    e.preventDefault();
    if (outcome === "SPLIT" && (!Number.isFinite(pct) || pct <= 0 || pct >= 100)) {
      return setError("Enter a buyer share between 1 and 99%");
    }
    setError(undefined);
    resolveDispute.mutate({ outcome, buyerRefundBps: bps, notes });
  }

  const resolveDispute = useMutation({
    mutationFn: async (decision: { outcome: Outcome; buyerRefundBps: number; notes: string }) => {
      if (!USE_MOCKS) {
        await api(`/admin/disputes/${order.id}/resolve`, {
          method: "POST",
          body: { ruling: RULING[decision.outcome], buyerRefundBps: decision.buyerRefundBps, resolutionNotes: decision.notes },
        });
      }
    },
    onSuccess: () => {
      const summary =
      outcome === "REFUND"
        ? `Refunded ${formatCents(split.buyer)} to the buyer. Order cancelled.`
        : outcome === "RELEASE"
          ? `Released ${formatCents(split.seller)} to the seller. Order completed.`
          : `Split: ${formatCents(split.buyer)} to buyer, ${formatCents(split.seller)} to seller, ${formatCents(split.platform)} platform fee.`;
      setResolved(summary);
      toast(`Order #${order.orderNumber} resolved.`);
    },
    onError: () => toast("The decision was not saved. Please try again.", "danger"),
  });

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          <Link href={`/orders/${order.id}`} className="underline">
            Order #{order.orderNumber}
          </Link>{" "}
          · {formatCents(order.priceCents)}
        </h2>
        {order.disputedAt ? <p className="text-xs text-muted-foreground">Opened {formatDateTime(order.disputedAt)}</p> : null}
      </div>
      <p className="text-sm">
        {order.gig.title} · Buyer <span className="font-semibold text-heading">{order.buyer.name}</span> · Seller{" "}
        <span className="font-semibold text-heading">{order.seller.name}</span>
      </p>
      {dispute ? (
        <blockquote className="border-l-4 border-border pl-3 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">{dispute.actor} wrote:</p>
          {dispute.detail}
        </blockquote>
      ) : null}

      {resolved ? (
        <Alert variant="success" title="Dispute resolved">
          {resolved}
        </Alert>
      ) : (
        <form onSubmit={resolve} noValidate className="space-y-4">
          <fieldset>
            <legend className="text-sm font-semibold text-heading">Decision</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["REFUND", "Full buyer refund"],
                  ["RELEASE", "Full seller release"],
                  ["SPLIT", "Custom split"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`outcome-${order.id}`}
                    checked={outcome === value}
                    onChange={() => setOutcome(value)}
                    className="h-4 w-4 accent-heading"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {outcome === "SPLIT" ? (
            <Field id={`split-${order.id}`} label="Buyer refund (%)" error={error}>
              {(p) => <Input {...p} inputMode="numeric" className="max-w-32" value={buyerPercent} onChange={(e) => setBuyerPercent(e.target.value)} />}
            </Field>
          ) : null}
          <dl className="grid grid-cols-3 gap-2 rounded-md bg-surface p-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Buyer</dt>
              <dd className="font-semibold text-heading">{formatCents(split.buyer)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Seller</dt>
              <dd className="font-semibold text-heading">{formatCents(split.seller)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Platform</dt>
              <dd className="font-semibold text-heading">{formatCents(split.platform)}</dd>
            </div>
          </dl>
          <Field id={`notes-${order.id}`} label="Admin notes (optional)">
            {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <Button type="submit">Resolve dispute</Button>
        </form>
      )}
    </Card>
  );
}
