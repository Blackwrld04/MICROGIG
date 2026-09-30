import type { Metadata } from "next";
import Link from "next/link";
import { SellerProfileForm } from "@/components/seller/seller-profile-form";
import { requireUser } from "@/modules/auth/session";
import { getMySellerProfile } from "@/modules/seller/queries";

export const metadata: Metadata = { title: "Seller profile" };
export const dynamic = "force-dynamic";

/** Seller profile & ID verification — SEL-01 / SEL-02. */
export default async function SellerProfilePage() {
  await requireUser({ next: "/seller/profile", accountType: "FREELANCER" });
  const { profile, verification } = await getMySellerProfile();
  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <Link href="/seller/dashboard" className="text-sm font-semibold text-heading hover:underline">
        ← Back to seller dashboard
      </Link>
      <h1 className="text-2xl font-bold">Seller profile</h1>
      <SellerProfileForm initial={profile} verification={verification} />
    </div>
  );
}
