"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api/client";
import type { NotificationsResponse } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";
import { USE_MOCKS } from "@/mocks/config";

/**
 * Bell with unread badge — NOT-01 / NOT-02. Server state via TanStack Query (prefetched by the
 * header, polled every 60 s against the real backend). "Mark all as read" → POST /notifications/read.
 */
export function NotificationBell({ serverNow }: { serverNow: number }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(queries.notifications());
  const items = data?.notifications ?? [];

  function markRead(ids: string[] | "all") {
    queryClient.setQueryData<NotificationsResponse>(queryKeys.notifications, (prev) => {
      if (!prev) return prev;
      const notifications = prev.notifications.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n));
      return { unreadCount: notifications.filter((n) => !n.read).length, notifications };
    });
  }

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!USE_MOCKS) await api("/notifications/read", { method: "POST" });
    },
    onMutate: () => markRead("all"), // optimistic
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
  const unread = items.filter((n) => !n.read).length;

  // Ring the bell only when unread goes UP after load (a new notification), not on mark-as-read.
  const lastUnread = useRef<number | null>(null);
  const [ringKey, setRingKey] = useState(0);
  useEffect(() => {
    if (lastUnread.current !== null && unread > lastUnread.current) setRingKey((k) => k + 1);
    lastUnread.current = unread;
  }, [unread]);
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-heading hover:bg-surface"
      >
        <Bell key={ringKey} className={cn("h-5 w-5", ringKey > 0 && "anim-wiggle")} aria-hidden />
        {unread > 0 ? (
          <span key={ringKey} className="anim-pop absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="px-2 text-xs font-semibold text-heading underline"
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link
                href={n.orderId ? `/orders/${n.orderId}` : "/orders"}
                onClick={() => markRead([n.id])}
                className="items-start"
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
                />
                <span className="flex flex-col">
                  <span className={cn(n.read ? "font-normal" : "font-semibold")}>
                    {n.message}
                    {n.read ? null : <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatRelative(n.createdAt, serverNow)}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/notifications" className="text-xs font-semibold">
            Notification preferences
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
