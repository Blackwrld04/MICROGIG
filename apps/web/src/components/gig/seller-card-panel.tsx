import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import { formatMonthYear, formatRelative } from "@/lib/time";
import { PROFICIENCY_LABELS } from "@/modules/seller/contracts";
import type { SellerCard } from "@/modules/catalog/contracts";

/** "About the seller" — SEL-03 computed credibility stats. */
export function SellerCardPanel({
  seller,
  nowMs,
  showProfileLink = true,
}: {
  seller: SellerCard;
  nowMs: number;
  showProfileLink?: boolean;
}) {
  const stats = [
    ["From", seller.country],
    ["Member since", formatMonthYear(seller.memberSince)],
    ["Avg. response time", `${seller.avgResponseHours} ${seller.avgResponseHours === 1 ? "hour" : "hours"}`],
    ["Last delivery", seller.lastDeliveryAt ? formatRelative(seller.lastDeliveryAt, nowMs) : "No deliveries yet"],
    ["Order completion rate", `${seller.completionRate}%`],
    ["Languages", seller.languages.map((l) => `${l.language} (${PROFICIENCY_LABELS[l.proficiency]})`).join(", ")],
  ];
  return (
    <div className="rounded-lg border border-border p-5">
      <div className="flex items-center gap-4">
        <Avatar name={seller.displayName} src={seller.avatarUrl} size={56} />
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-heading">
            {seller.displayName}
            {seller.idVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
              </span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">{seller.headline}</p>
        </div>
        {showProfileLink ? (
          <Link href={`/sellers/${seller.id}`} className="ml-auto text-sm font-semibold text-heading underline">
            View profile
          </Link>
        ) : null}
      </div>
      <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold text-heading">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
