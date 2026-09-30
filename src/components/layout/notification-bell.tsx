"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/mocks/account";

/**
 * Bell with unread badge — NOT-01 / NOT-02.
 * TODO: poll GET /api/v1/notifications; POST /notifications/read on "Mark all as read".
 */
export function NotificationBell({ initial, serverNow }: { initial: NotificationItem[]; serverNow: number }) {
  const [items, setItems] = useState(initial);
  const unread = items.filter((n) => !n.read).length;
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-heading hover:bg-surface"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
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
              onClick={() => setItems((all) => all.map((n) => ({ ...n, read: true })))}
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
                onClick={() => setItems((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
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
