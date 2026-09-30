import type { Metadata } from "next";
import Link from "next/link";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { SellerProfileForm } from "@/components/seller/seller-profile-form";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Seller profile" };
export const dynamic = "force-dynamic";

/** Seller profile & ID verification — SEL-01 / SEL-02. Freelancer accounts only. */
export default async function SellerProfilePage() {
  await requireUser({ next: "/seller/profile", accountType: "FREELANCER" });
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.sellerProfile(), queryFn: () => serverData.sellerProfile() });
  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <Link href="/seller/dashboard" className="text-sm font-semibold text-heading hover:underline">
        ← Back to seller dashboard
      </Link>
      <h1 className="text-2xl font-bold">Seller profile</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SellerProfileForm />
      </HydrationBoundary>
    </div>
  );
}
