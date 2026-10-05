"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { useNewIds } from "@/components/motion/use-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { WalletResponse } from "@/lib/api/types";
import { formatCents, formatSignedCents, parseDollarsToCents } from "@/lib/money";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { WalletActivity } from "@/mocks/account";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";

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

/** Balance cards per account type (client XOR freelancer), from the wallet response. */
function cardsFor(wallet: WalletResponse) {
  if (wallet.accountType === "FREELANCER") {
    return [
      { label: "Available for withdrawal", value: wallet.summary.available, note: "Withdraw any time" },
      { label: "Pending clearance", value: wallet.summary.pending, note: "3-day hold after completion" },
      { label: "In active orders", value: wallet.summary.inActiveOrders, note: "Held in escrow" },
      { label: "Earnings to date", value: wallet.summary.lifetimeEarnings, note: "Before withdrawals" },
    ];
  }
  return [
    { label: "Available balance", value: wallet.summary.available, note: "Spend on new orders" },
    { label: "In escrow", value: wallet.summary.inEscrow, note: "Released when you accept delivery" },
    { label: "Total spent", value: wallet.summary.totalSpent, note: "Completed orders" },
  ];
}

/**
 * Wallet & earnings — PRD §11.6 / §16.7. Server state via TanStack Query; top-up and withdraw
 * are mutations (demo: applied to the cache; real: POST, then refetch).
 * TODO(ledger owner): top-up / withdraw endpoints aren't in PRD §12 yet; CSV via GET /wallet/activity?format=csv.
 */
export function WalletView() {
  const queryClient = useQueryClient();
  const { data: wallet } = useQuery(queries.wallet());
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string>();
  const freshRows = useNewIds(wallet?.activity.map((r) => r.txnId) ?? []); // highlight new ledger rows

  const move = useMutation({
    mutationFn: async (m: { type: "TOP_UP" | "WITHDRAWAL"; amountCents: number }) => {
      if (!USE_MOCKS) {
        await api(m.type === "TOP_UP" ? "/wallet/topup" : "/wallet/withdraw", { method: "POST", body: { amountCents: Math.abs(m.amountCents) } });
      }
      return m;
    },
    onSuccess: (m) => {
      if (USE_MOCKS) {
        // Demo: write a ledger row + new balance into the cached wallet.
        queryClient.setQueryData<WalletResponse>(queryKeys.wallet, (prev) => {
          if (!prev) return prev;
          const balanceCents = prev.summary.available + m.amountCents;
          const row: WalletActivity = {
            txnId: `txn_${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString(),
            description: m.type === "TOP_UP" ? "Virtual wallet top-up" : "Simulated payout",
            type: m.type,
            amountCents: m.amountCents,
            balanceCents,
          };
          return { ...prev, summary: { ...prev.summary, available: balanceCents }, activity: [row, ...prev.activity] } as WalletResponse;
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      }
      toast(
        m.type === "TOP_UP"
          ? `${formatCents(m.amountCents)} virtual test funds added.`
          : `${formatCents(-m.amountCents)} withdrawal simulated.`,
      );
    },
    onError: (err) => toast(err instanceof Error ? err.message : "That didn't work. Please try again.", "danger"),
  });

  if (!wallet) return null;
  const mode = wallet.accountType;
  const available = wallet.summary.available;
  const activity = wallet.activity; // newest first
  const liveCards = cardsFor(wallet);

  function withdraw(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseDollarsToCents(amount);
    if (cents === null || cents <= 0) return setAmountError("Enter an amount like 25 or 25.50");
    if (cents > available) return setAmountError(`You can withdraw up to ${formatCents(available)}`);
    move.mutate({ type: "WITHDRAWAL", amountCents: -cents });
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

  return (
    <div className="space-y-6">
      <ul className={cn("grid gap-4 sm:grid-cols-2", liveCards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {liveCards.map((c) => (
          <li key={c.label}>
            <Card className="h-full p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-heading">
                <AnimatedNumber value={c.value} format={formatCents} />
              </p>
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
          disabled={move.isPending}
          onClick={() => move.mutate({ type: "TOP_UP", amountCents: TOP_UP_CENTS })}
        >
          <Plus aria-hidden /> Add {formatCents(TOP_UP_CENTS)} virtual test funds
        </Button>
        ) : null}
      </div>


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
                <tr key={r.txnId} className={freshRows.has(r.txnId) ? "anim-flash" : undefined}>
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
