"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/common/avatar";
import { api } from "@/lib/api/client";
import type { Me } from "@/modules/auth/contracts";

export function UserMenu({ user }: { user: Me }) {
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
        <Avatar name={user.fullName} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/orders">Manage orders</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inbox">Inbox</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wallet">Wallet</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/seller/dashboard">{user.isSeller ? "Seller dashboard" : "Become a seller"}</Link>
        </DropdownMenuItem>
        {user.isSeller ? (
          <DropdownMenuItem asChild>
            <Link href="/gigs/new">Create a gig</Link>
          </DropdownMenuItem>
        ) : null}
        {user.isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Admin</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/admin/verifications">ID verifications</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/disputes">Disputes</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/security">Security</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/notifications">Notification preferences</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
