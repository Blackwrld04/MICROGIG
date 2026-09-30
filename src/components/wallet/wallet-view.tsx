"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatCents, formatSignedCents, parseDollarsToCents } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { WalletActivity } from "@/mocks/account";

const TOP_UP_CENTS = 5000;

const TYPE_LABELS: Record<WalletActivity["type"], string> = {
  TOP_UP: "Top-up",
  ORDER_PLACED: "Order placed",
  ORDER_COMPLETED: "Order completed",
  CLEARING: "Cleared",
  ORDER_REFUNDED: "Refund",
  WITHDRAWAL: "Withdrawal",
  DISPUTE_ADJUSTMENT: "Dispute adjustment",
};

function toCsv(rows: WalletActivity[]): string {
  const header = ["Date", "Transaction ID", "Description", "Type", "Amount (USD)", "Balance (USD)"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.createdAt, r.txnId, r.description, r.type, (r.amountCents / 100).toFixed(2), (r.balanceCents / 100).toFixed(2)]
      .map(String)
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\r\n");
}

/**
 * Wallet & earnings — PRD §11.6 / §16.7.
 * TODO: POST top-up / withdraw endpoints (not yet in §12); CSV via GET /api/v1/wallet/activity?format=csv.
 */
export function WalletView({
  mode,
  cards,
  initialAvailable,
  initialActivity,
}: {
  mode: "CLIENT" | "FREELANCER";
  /** First card is always the live available balance. */
  cards: { label: string; value: number; note: string }[];
  initialAvailable: number;
  initialActivity: WalletActivity[];
}) {
  const [available, setAvailable] = useState(initialAvailable);
  const [activity, setActivity] = useState(initialActivity); // newest first
  const [notice, setNotice] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string>();

  function record(type: WalletActivity["type"], description: string, amountCents: number) {
    const balanceCents = available + amountCents;
    setAvailable(balanceCents);
    setActivity((a) => [
      { txnId: `txn_${Date.now().toString().slice(-6)}`, createdAt: new Date().toISOString(), description, type, amountCents, balanceCents },
      ...a,
    ]);
  }

  function withdraw(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseDollarsToCents(amount);
    if (cents === null || cents <= 0) return setAmountError("Enter an amount like 25 or 25.50");
    if (cents > available) return setAmountError(`You can withdraw up to ${formatCents(available)}`);
    record("WITHDRAWAL", "Simulated payout", -cents);
    setNotice(`${formatCents(cents)} withdrawal simulated.`);
    setAmount("");
    setAmountError(undefined);
    setWithdrawOpen(false);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(activity)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "microgig-wallet-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const liveCards = cards.map((c, i) => (i === 0 ? { ...c, value: available } : c));

  return (
    <div className="space-y-6">
      <ul className={cn("grid gap-4 sm:grid-cols-2", liveCards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {liveCards.map((c) => (
          <li key={c.label}>
            <Card className="h-full p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-heading">{formatCents(c.value)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {mode === "FREELANCER" ? (
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button variant="dark" disabled={available <= 0}>
              Withdraw balance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Withdraw funds</DialogTitle>
            <DialogDescription>Simulated payout. Available: {formatCents(available)}.</DialogDescription>
            <form onSubmit={withdraw} noValidate className="space-y-4">
              <Field id="withdraw-amount" label="Amount (USD)" error={amountError}>
                {(props) => <Input {...props} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" />}
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAmount((available / 100).toFixed(2))}>
                  Withdraw all
                </Button>
                <Button type="submit">Withdraw</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        ) : null}
        {mode === "CLIENT" ? (
        <Button
          variant="outline"
          onClick={() => {
            record("TOP_UP", "Virtual wallet top-up", TOP_UP_CENTS);
            setNotice(`${formatCents(TOP_UP_CENTS)} virtual test funds added.`);
          }}
        >
          <Plus aria-hidden /> Add {formatCents(TOP_UP_CENTS)} virtual test funds
        </Button>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {notice}
      </p>
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <section aria-labelledby="activity-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="activity-heading" className="text-lg font-semibold">
            Transaction activity
          </h2>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download aria-hidden /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Wallet transactions, newest first</caption>
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Txn ID</th>
                <th scope="col" className="px-4 py-3 font-semibold">Description</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activity.map((r) => (
                <tr key={r.txnId}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.txnId}</td>
                  <td className="px-4 py-3">{r.description}</td>
                  <td className="px-4 py-3">{TYPE_LABELS[r.type]}</td>
                  <td className={cn("px-4 py-3 text-right font-semibold", r.amountCents > 0 ? "text-emerald-800" : "text-heading")}>
                    {formatSignedCents(r.amountCents)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCents(r.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
