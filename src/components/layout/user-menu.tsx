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

/** Account menu. Clients and freelancers see only their own side — there is no role switch. */
export function UserMenu({ user }: { user: Me }) {
  const freelancer = user.accountType === "FREELANCER";

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
        <Avatar name={user.fullName} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block text-sm text-heading">{user.fullName}</span>
          <span className="font-normal">{user.isAdmin ? "Administrator" : freelancer ? "Freelancer account" : "Client account"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {freelancer ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/seller/dashboard">Seller dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/gigs/new">Create a gig</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/seller/profile">Seller profile</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        {!user.isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/orders">{freelancer ? "Orders to deliver" : "My orders"}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/inbox">Inbox</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/wallet">{freelancer ? "Earnings" : "Wallet"}</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        {user.isAdmin ? (
          <>
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
