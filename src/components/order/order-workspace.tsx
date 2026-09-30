"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCents } from "@/lib/money";
import { formatDate, isLate } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  activeDeadline,
  applyAction,
  availableActions,
  type ActionPayload,
} from "@/modules/orders/state-machine";
import type { OrderDetail } from "@/modules/orders/types";
import { ConfirmDialog, ReasonDialog, ReviewDialog } from "./action-dialogs";
import { ActivityLog } from "./activity-log";
import { Countdown } from "./countdown";
import { DeliverForm } from "./deliver-form";
import { DeliveryCard } from "./delivery-card";
import { MessageThread } from "./message-thread";
import { LateBadge, OrderStatusBadge } from "./order-status-badge";
import { OrderStepper } from "./order-stepper";
import { RequirementsForm } from "./requirements-form";

const SUCCESS: Record<ActionPayload["type"], string> = {
  SUBMIT_REQUIREMENTS: "Requirements submitted. The delivery countdown has started.",
  CANCEL_UNSTARTED: "Order cancelled. The full amount was refunded to your wallet.",
  DELIVER: "Delivery submitted. The buyer has 72 hours to review it.",
  ACCEPT: "Delivery accepted. Funds were released to the seller.",
  REQUEST_REVISION: "Revision requested. The seller has 24 hours to redeliver.",
  OPEN_DISPUTE: "Dispute opened. An admin will review this order.",
  LATE_CANCEL: "Order cancelled for late delivery. The full amount was refunded to your wallet.",
  REQUEST_MUTUAL_CANCEL: "Cancellation requested. Waiting for the other party.",
  ACCEPT_MUTUAL_CANCEL: "Order cancelled by mutual agreement. The buyer was refunded in full.",
  LEAVE_REVIEW: "Thanks for your review!",
};

/**
 * Order workspace — ORD-03, PRD §16.4.
 * Demo mode applies actions locally via the state machine.
 * TODO: call the matching POST /api/v1/orders/:id/* endpoint, then replace state with the response (409 → refetch).
 */
export function OrderWorkspace({
  initial,
  serverNow,
  readOnly = false,
}: {
  initial: OrderDetail;
  serverNow: number;
  /** Admin viewing someone else's order: no actions, no composer. */
  readOnly?: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [now, setNow] = useState(serverNow);
  const [tab, setTab] = useState(() =>
    initial.status === "DELIVERED" || (initial.viewerRole === "seller" && ["IN_PROGRESS", "IN_REVISION"].includes(initial.status))
      ? "deliverables"
      : "details",
  );
  const [announcement, setAnnouncement] = useState("");
  // Device time when the page mounted; serverNow - mountedAt is the clock offset.
  const [mountedAt, setMountedAt] = useState(serverNow);

  // Keep "now" moving (late flags, remedy availability) on the server clock.
  useEffect(() => {
    const mounted = Date.now();
    setMountedAt(mounted);
    const id = window.setInterval(() => setNow(serverNow + (Date.now() - mounted)), 30_000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  const role = order.viewerRole;
  const actions = readOnly ? [] : availableActions(order, role, now);
  const can = (a: ActionPayload["type"]) => actions.includes(a);
  const late = isLate(order, now);
  const viewerName = role === "buyer" ? order.buyer.name : order.seller.name;
  const counterparty = role === "buyer" ? order.seller.name : order.buyer.name;

  function act(payload: ActionPayload) {
    const at = Date.now() + (serverNow - mountedAt);
    setOrder((o) => applyAction(o, payload, role, at));
    setNow(at);
    setAnnouncement(SUCCESS[payload.type]);
    if (payload.type === "DELIVER") setTab("deliverables");
  }

  const due = activeDeadline(order);
  const countdown =
    order.status === "DELIVERED" && order.autoCompleteAt
      ? { label: "Auto-completes in", target: order.autoCompleteAt }
      : due
        ? { label: order.status === "IN_REVISION" ? "Revision due" : "Delivery due", target: due }
        : null;

  return (
    <div className="container space-y-6 py-8">
      <Link href={readOnly ? "/admin/disputes" : "/orders"} className="text-sm font-semibold text-heading hover:underline">
        ← {readOnly ? "Back to disputes" : "Back to orders"}
      </Link>

      {/* Header */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              Order #{order.orderNumber}
              {readOnly ? null : (
              <button
                type="button"
                aria-pressed={order.isStarred}
                aria-label={order.isStarred ? "Unstar order" : "Star order"}
                onClick={() => setOrder((o) => ({ ...o, isStarred: !o.isStarred }))}
                className="rounded p-1 hover:bg-surface"
              >
                <Star className={cn("h-5 w-5 text-heading", order.isStarred && "fill-heading")} aria-hidden />
              </button>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Placed on {formatDate(order.createdAt)} • Total: {formatCents(order.priceCents)} (Escrow Secured)
            </p>
            <p className="text-sm">
              <Link href={`/gigs/${order.gig.slug}`} className="font-semibold text-heading underline">
                {order.gig.title}
              </Link>
            </p>
          </div>
          <div className="space-y-2 text-right">
            <div className="flex flex-wrap justify-end gap-1">
              <OrderStatusBadge status={order.status} />
              {late ? <LateBadge /> : null}
            </div>
            {countdown ? (
              <p className="text-sm">
                <span className="text-muted-foreground">{countdown.label}: </span>
                <Countdown target={countdown.target} serverNow={new Date(serverNow).toISOString()} />
              </p>
            ) : null}
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <OrderStepper order={order} />
        </div>
      </Card>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {announcement ? <Alert variant="success">{announcement}</Alert> : null}

      {/* Situation banners */}
      {can("LATE_CANCEL") ? (
        <Alert variant="danger" title="This order is more than 24 hours late">
          You can cancel now and get a full refund to your wallet.
        </Alert>
      ) : late ? (
        <Alert variant="warning" title="Past the delivery deadline">
          {role === "seller" ? "Deliver as soon as possible to avoid a cancellation." : "The seller has missed the deadline."}
        </Alert>
      ) : null}
      {order.status === "DISPUTED" ? (
        <Alert variant="info" title="Under admin review">
          Timers are paused while an administrator reviews this dispute. Both parties will be notified of the decision.
        </Alert>
      ) : null}
      {order.status === "CANCELLED" ? (
        <Alert variant="info" title="Order cancelled">
          The full {formatCents(order.priceCents)} was refunded to the buyer&apos;s wallet.
        </Alert>
      ) : null}
      {order.mutualCancelRequestedBy && order.status === "IN_PROGRESS" ? (
        <Alert variant="warning" title="Mutual cancellation requested">
          {order.mutualCancelRequestedBy === role
            ? `Waiting for ${counterparty} to respond.`
            : `${counterparty} asked to cancel this order. If you agree, the buyer is refunded in full.`}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList aria-label="Order workspace sections">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables ({order.deliveries.length})</TabsTrigger>
            <TabsTrigger value="messages">Messages &amp; Files ({order.messages.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <h2 className="text-base font-semibold">Requirements brief</h2>
            {order.requirementsAnswers ? (
              <dl className="space-y-4 rounded-lg border border-border p-4 text-sm">
                {order.requirementsPrompt.map((q, i) => (
                  <div key={q}>
                    <dt className="font-semibold text-heading">{q}</dt>
                    <dd className="mt-1 whitespace-pre-wrap">{order.requirementsAnswers?.[i]}</dd>
                  </div>
                ))}
              </dl>
            ) : can("SUBMIT_REQUIREMENTS") ? (
              <div className="space-y-3">
                <Alert variant="info">Answer the seller&apos;s questions to start the order. The delivery clock starts when you submit.</Alert>
                <RequirementsForm prompts={order.requirementsPrompt} onSubmit={(answers) => act({ type: "SUBMIT_REQUIREMENTS", answers })} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for the buyer to submit requirements.</p>
            )}
          </TabsContent>

          <TabsContent value="deliverables" className="space-y-4">
            {can("DELIVER") ? <DeliverForm onDeliver={(delivery) => act({ type: "DELIVER", delivery })} /> : null}
            {order.deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliveries yet.</p>
            ) : (
              [...order.deliveries]
                .reverse()
                .map((d) => (
                  <DeliveryCard
                    key={d.id}
                    delivery={d}
                    unlocked={order.status === "COMPLETED" && role === "buyer"}
                    nowMs={now}
                  />
                ))
            )}
          </TabsContent>

          <TabsContent value="messages" className="space-y-3">
            {readOnly ? null : (
              <Link href={`/inbox?thread=${order.id}`} className="inline-block text-sm font-semibold text-heading underline">
                Open in inbox
              </Link>
            )}
            <MessageThread
              messages={order.messages}
              viewerRole={role}
              viewerName={viewerName}
              disabled={readOnly || order.status === "CANCELLED"}
              onSend={(m) => setOrder((o) => ({ ...o, messages: [...o.messages, m] }))}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLog events={order.events} />
          </TabsContent>
        </Tabs>

        {/* Actions & summary */}
        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="text-base font-semibold">{readOnly ? "Admin view (read-only)" : role === "buyer" ? "Your actions" : "Seller actions"}</h2>
            {can("SUBMIT_REQUIREMENTS") ? (
              <Button className="w-full" onClick={() => setTab("details")}>
                Submit requirements
              </Button>
            ) : null}
            {can("DELIVER") ? (
              <Button className="w-full" onClick={() => setTab("deliverables")}>
                Deliver completed work
              </Button>
            ) : null}
            {can("ACCEPT") ? (
              <ConfirmDialog
                trigger="Accept Delivery & Release Funds"
                title="Accept this delivery?"
                description={`The order will be completed and ${formatCents(order.priceCents)} released from escrow to the seller. This can't be undone.`}
                confirmLabel="Accept & complete order"
                onConfirm={() => act({ type: "ACCEPT" })}
              />
            ) : null}
            {order.status === "DELIVERED" && role === "buyer" && !readOnly ? (
              can("REQUEST_REVISION") ? (
                <ReasonDialog
                  trigger={`Request Revision (${order.revisionsUsed} of ${order.revisionsIncluded} used)`}
                  title="Request a revision"
                  description={`Tell the seller exactly what to change. They'll have 24 hours. You have ${order.revisionsIncluded - order.revisionsUsed} revision(s) left.`}
                  label="What should be changed?"
                  minLength={20}
                  confirmLabel="Send revision request"
                  onSubmit={(feedback) => act({ type: "REQUEST_REVISION", feedback })}
                />
              ) : (
                <div className="space-y-1">
                  <Button variant="outline" className="w-full" disabled>
                    Request Revision ({order.revisionsUsed} of {order.revisionsIncluded} used)
                  </Button>
                  <p className="text-xs text-muted-foreground">All included revisions are used. Accept the delivery or open a dispute.</p>
                </div>
              )
            ) : null}
            {can("LATE_CANCEL") ? (
              <ConfirmDialog
                trigger="Cancel & Refund Order"
                triggerVariant="destructive"
                title="Cancel this late order?"
                description={`The seller is more than 24 hours late. ${formatCents(order.priceCents)} will be refunded to your wallet.`}
                confirmLabel="Cancel & refund"
                onConfirm={() => act({ type: "LATE_CANCEL" })}
              />
            ) : null}
            {can("CANCEL_UNSTARTED") ? (
              <ConfirmDialog
                trigger="Cancel order"
                triggerVariant="outline"
                title="Cancel this order?"
                description={`The order hasn't started yet. ${formatCents(order.priceCents)} will be refunded to your wallet in full.`}
                confirmLabel="Cancel order"
                onConfirm={() => act({ type: "CANCEL_UNSTARTED" })}
              />
            ) : null}
            {can("ACCEPT_MUTUAL_CANCEL") ? (
              <ConfirmDialog
                trigger="Accept cancellation"
                title="Agree to cancel?"
                description="The buyer will be refunded in full and the order closed."
                confirmLabel="Agree & cancel"
                onConfirm={() => act({ type: "ACCEPT_MUTUAL_CANCEL" })}
              />
            ) : null}
            {can("REQUEST_MUTUAL_CANCEL") && order.mutualCancelRequestedBy !== role ? (
              <ConfirmDialog
                trigger="Request mutual cancellation"
                triggerVariant="outline"
                title="Ask to cancel this order?"
                description={`${counterparty} must agree. If they do, the buyer is refunded in full.`}
                confirmLabel="Send request"
                onConfirm={() => act({ type: "REQUEST_MUTUAL_CANCEL" })}
              />
            ) : null}
            {can("LEAVE_REVIEW") ? (
              <ReviewDialog onSubmit={(rating, body) => act({ type: "LEAVE_REVIEW", rating, body })} />
            ) : null}
            {can("OPEN_DISPUTE") ? (
              <ReasonDialog
                trigger="Need help? Open a dispute"
                triggerVariant="ghost"
                title="Open a dispute"
                description="An administrator will review the order and decide on a refund, release or split. Timers pause while the dispute is open."
                label="Describe the problem"
                minLength={50}
                confirmLabel="Open dispute"
                onSubmit={(reason) => act({ type: "OPEN_DISPUTE", reason })}
              />
            ) : null}
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {readOnly
                  ? "Admins can read this order but not act on it. Resolve disputes from the Disputes page."
                  : order.status === "DELIVERED" && role === "seller"
                  ? "Waiting for the buyer to review your delivery."
                  : order.status === "COMPLETED"
                    ? "Order complete."
                    : "No actions needed right now."}
              </p>
            ) : null}
            {order.review ? (
              <p className="border-t border-border pt-3 text-sm">
                <span className="font-semibold text-heading">Review: {order.review.rating}/5</span>
                {order.review.body ? ` — “${order.review.body}”` : null}
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Order summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{role === "buyer" ? "Seller" : "Buyer"}</dt>
                <dd className="font-semibold text-heading">{counterparty}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-semibold text-heading">{formatCents(order.priceCents)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Delivery time</dt>
                <dd className="font-semibold text-heading">{order.turnaroundHours} hours</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Revisions</dt>
                <dd className="font-semibold text-heading">
                  {order.revisionsUsed} of {order.revisionsIncluded} used
                </dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
