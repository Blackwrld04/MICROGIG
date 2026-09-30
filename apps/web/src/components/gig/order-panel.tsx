"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api, newIdempotencyKey } from "@/lib/api/client";
import { formatCents } from "@/lib/money";
import { queryKeys } from "@/lib/query/keys";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";

const TOP_UP_CENTS = 5000; // "Add $50 Virtual Test Funds" — §19 risk #3

/**
 * Sticky order card + checkout — ORD-01. Buyer pays exactly the gig price (seller-side fee only, §19 #2).
 * Checkout is a TanStack mutation: POST /api/v1/orders with an Idempotency-Key; 402 → top-up prompt.
 */
export function OrderPanel({
  gigId,
  priceCents,
  turnaroundHours,
  revisionsIncluded,
  requirementsPrompt,
  walletAvailableCents,
  viewer,
  gigPath,
}: {
  priceCents: number;
  turnaroundHours: number;
  revisionsIncluded: number;
  requirementsPrompt: string[];
  walletAvailableCents: number;
  gigId: string;
  /** Only clients can order; accounts are client XOR freelancer. */
  viewer: "guest" | "client" | "freelancer" | "own" | "admin";
  gigPath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [balance, setBalance] = useState(walletAvailableCents);
  // One key per checkout attempt, reused on retry so a double click can't create two orders.
  const idempotencyKey = useRef<string | null>(null);

  const insufficient = balance < priceCents;

  function openCheckout() {
    idempotencyKey.current = newIdempotencyKey();
    setOpen(true);
  }

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (USE_MOCKS) {
        // Demo: simulate 201 Created and open the sample order waiting for requirements.
        await new Promise((r) => setTimeout(r, 400));
        return { orderId: "84931" };
      }
      return api<{ orderId: string }>("/orders", {
        method: "POST",
        body: { gigId },
        idempotencyKey: idempotencyKey.current ?? newIdempotencyKey(),
      });
    },
    onSuccess: ({ orderId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/orders/${orderId}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.kind === "payment_required") {
        setBalance(0); // show the top-up prompt
        return;
      }
      toast(err instanceof Error ? err.message : "Your order was not placed. Please try again.", "danger");
    },
  });
  const submitting = placeOrder.isPending || placeOrder.isSuccess;

  const topUp = useMutation({
    mutationFn: async () => {
      if (!USE_MOCKS) await api("/wallet/top-up", { method: "POST", body: { amountCents: TOP_UP_CENTS } });
    },
    onSuccess: () => {
      setBalance((b) => b + TOP_UP_CENTS);
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      toast(`${formatCents(TOP_UP_CENTS)} virtual test funds added.`);
    },
    onError: () => toast("Funds were not added. Please try again.", "danger"),
  });

  function confirm() {
    placeOrder.mutate();
  }

  return (
    <Card className="p-5 lg:sticky lg:top-40">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Fixed price service</h2>
        <p className="text-2xl font-bold text-heading">{formatCents(priceCents)}</p>
      </div>
      <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <li className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-heading" aria-hidden /> {turnaroundHours} hours delivery
        </li>
        <li className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-heading" aria-hidden /> {revisionsIncluded}{" "}
          {revisionsIncluded === 1 ? "revision" : "revisions"} included
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-heading" aria-hidden /> Escrow payment protection
        </li>
      </ul>
      <div className="mt-4 border-t border-border pt-4 text-sm">
        <p className="font-semibold text-heading">Requirements needed:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {requirementsPrompt.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>

      {viewer === "own" ? (
        <div className="mt-5 space-y-2">
          <Alert variant="info">This is your gig. Clients see the order button here.</Alert>
          <Button asChild variant="outline" className="w-full">
            <Link href="/seller/dashboard">Manage in seller dashboard</Link>
          </Button>
        </div>
      ) : viewer === "freelancer" || viewer === "admin" ? (
        <Alert variant="info" className="mt-5">
          {viewer === "admin" ? "Admin accounts can't place orders." : "Freelancer accounts sell gigs and can't place orders."}
        </Alert>
      ) : viewer === "guest" ? (
        <Button asChild size="lg" className="mt-5 w-full">
          <Link href={`/register?role=client&next=${encodeURIComponent(gigPath)}`}>Sign up to order ({formatCents(priceCents)})</Link>
        </Button>
      ) : (
        <Button size="lg" className="mt-5 w-full" onClick={openCheckout}>
          Order Now &amp; Lock Escrow ({formatCents(priceCents)})
        </Button>
      )}
      <p className="mt-2 text-center text-xs text-muted-foreground">Protected by microgig double-entry escrow</p>

      <Dialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
        <DialogContent>
          <DialogTitle>Confirm your order</DialogTitle>
          <DialogDescription>
            {formatCents(priceCents)} moves from your wallet into escrow. The seller is paid only after you accept the
            delivery.
          </DialogDescription>
          <dl className="space-y-2 rounded-md bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <dt>Order total</dt>
              <dd className="font-semibold text-heading">{formatCents(priceCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Service fee</dt>
              <dd className="font-semibold text-heading">{formatCents(0)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt>Wallet balance</dt>
              <dd className="font-semibold text-heading">{formatCents(balance)}</dd>
            </div>
          </dl>
          {insufficient ? (
            <Alert variant="warning" title="Not enough balance">
              <p>Add virtual test funds to continue.</p>
              <Button variant="outline" size="sm" className="mt-2" disabled={topUp.isPending} onClick={() => topUp.mutate()}>
                Add {formatCents(TOP_UP_CENTS)} Virtual Test Funds
              </Button>
            </Alert>
          ) : null}
          <Button size="lg" onClick={confirm} disabled={insufficient || submitting}>
            {submitting ? "Placing order…" : `Confirm purchase (${formatCents(priceCents)})`}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
