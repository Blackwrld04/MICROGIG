"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ChevronLeft, Star } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import { MessageThread } from "@/components/order/message-thread";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { InboxThread } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";
import { USE_MOCKS } from "@/mocks/config";
import { useInboxUiStore, type InboxTab } from "@/stores/inbox-ui-store";
import { toast } from "@/stores/toast-store";

const TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "archived", label: "Archived" },
] as const;
type Tab = InboxTab;

function matches(t: InboxThread, tab: Tab) {
  switch (tab) {
    case "all":
      return !t.archived;
    case "unread":
      return !t.archived && t.unreadCount > 0;
    case "starred":
      return t.starred;
    case "archived":
      return t.archived;
  }
}

/**
 * Messaging inbox — MSG-02. Threads are order-scoped (MSG-01).
 * Server state (threads) via TanStack Query, polled every 15 s against the real backend.
 * Client UI state (open tab, open conversation) via Zustand.
 */
export function Inbox({ initialThreadId, serverNow }: { initialThreadId?: string; serverNow: number }) {
  const queryClient = useQueryClient();
  const { data: threads = [] } = useQuery(queries.inbox());
  const tab = useInboxUiStore((s) => s.tab);
  const setTab = useInboxUiStore((s) => s.setTab);
  const selectedId = useInboxUiStore((s) => s.selectedId);
  const setSelectedId = useInboxUiStore((s) => s.select);

  const visible = useMemo(() => threads.filter((t) => matches(t, tab)), [threads, tab]);
  const selected = threads.find((t) => t.orderId === selectedId) ?? null;
  const counts = Object.fromEntries(TABS.map((t) => [t.id, threads.filter((x) => matches(x, t.id)).length])) as Record<Tab, number>;

  /** Update one thread in the TanStack cache (optimistic; real mode also tells the backend). */
  const patch = (id: string, change: Partial<InboxThread>) =>
    queryClient.setQueryData<InboxThread[]>(queryKeys.inbox, (all) => all?.map((t) => (t.orderId === id ? { ...t, ...change } : t)));

  // TODO(messaging owner): read/star/archive endpoints aren't in PRD §12; demo keeps them client-side.
  const send = useMutation({
    mutationFn: async ({ thread, message }: { thread: InboxThread; message: InboxThread["messages"][number] }) => {
      if (!USE_MOCKS) await api(`/orders/${thread.orderId}/messages`, { method: "POST", body: { body: message.body, attachmentKey: null } });
      return message;
    },
    onMutate: ({ thread, message }) =>
      patch(thread.orderId, { messages: [...thread.messages, message], lastActivityAt: message.createdAt, archived: false }),
    onSuccess: () => {
      if (!USE_MOCKS) void queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
    },
    onError: () => toast("Your message was not sent. Please try again.", "danger"),
  });

  function open(id: string) {
    setSelectedId(id);
    patch(id, { unreadCount: 0 });
  }

  // Deep link (?thread=) opens that conversation; leaving the page resets the view.
  useEffect(() => {
    setSelectedId(null);
    setTab("all");
    if (initialThreadId) open(initialThreadId);
    return () => setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per deep link
  }, [initialThreadId]);

  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-lg border border-border md:grid-cols-[340px_1fr]">
      {/* Thread list */}
      <div className={cn("flex flex-col border-border md:border-r", selected && "hidden md:flex")}>
        <div role="tablist" aria-label="Filter conversations" className="flex overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold",
                tab === t.id ? "border-primary text-heading" : "border-transparent text-muted-foreground hover:text-heading",
              )}
            >
              {t.label} <span className="text-xs">({counts[t.id]})</span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No conversations here.</p>
        ) : (
          <ul className="flex-1 divide-y divide-border overflow-y-auto" aria-label="Conversations">
            {visible.map((t) => {
              const last = t.messages.at(-1);
              return (
                <li key={t.orderId}>
                  <button
                    type="button"
                    onClick={() => open(t.orderId)}
                    aria-current={t.orderId === selectedId ? "true" : undefined}
                    className={cn("flex w-full gap-3 p-4 text-left hover:bg-surface", t.orderId === selectedId && "bg-surface")}
                  >
                    <Avatar name={t.counterpartyName} src={t.counterpartyAvatar} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm text-heading", t.unreadCount > 0 ? "font-bold" : "font-semibold")}>
                          {t.counterpartyName}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(t.lastActivityAt, serverNow)}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        #{t.orderNumber} · {t.gigTitle}
                      </span>
                      <span className={cn("mt-0.5 block truncate text-sm", t.unreadCount > 0 ? "font-semibold text-heading" : "text-muted-foreground")}>
                        {last ? `${last.senderRole === t.viewerRole ? "You: " : ""}${last.body || last.attachmentName}` : "No messages yet"}
                      </span>
                    </span>
                    {t.unreadCount > 0 ? (
                      <span className="mt-1 flex h-5 min-w-5 items-center justify-center self-start rounded-full bg-heading px-1.5 text-xs font-bold text-white">
                        {t.unreadCount}
                        <span className="sr-only"> unread</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Conversation */}
      <div className={cn("min-w-0 flex-col", selected ? "flex" : "hidden md:flex")}>
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Back to conversations" onClick={() => setSelectedId(null)}>
                <ChevronLeft aria-hidden />
              </Button>
              <Avatar name={selected.counterpartyName} src={selected.counterpartyAvatar} size={36} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{selected.counterpartyName}</h2>
                <Link href={`/orders/${selected.orderId}`} className="block truncate text-xs text-heading underline">
                  Order #{selected.orderNumber} · {selected.gigTitle}
                </Link>
              </div>
              <OrderStatusBadge status={selected.status} />
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={selected.starred}
                aria-label={selected.starred ? "Unstar conversation" : "Star conversation"}
                onClick={() => patch(selected.orderId, { starred: !selected.starred })}
              >
                <Star className={cn(selected.starred && "fill-heading")} aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={selected.archived ? "Move to inbox" : "Archive conversation"}
                onClick={() => patch(selected.orderId, { archived: !selected.archived })}
              >
                {selected.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <MessageThread
                key={selected.orderId}
                messages={selected.messages}
                viewerRole={selected.viewerRole}
                viewerName={selected.viewerName}
                disabled={selected.status === "CANCELLED"}
                onSend={(m) => send.mutate({ thread: selected, message: m })}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
            Select a conversation to read and reply.
          </div>
        )}
      </div>
    </div>
  );
}
