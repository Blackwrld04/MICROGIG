import { GigCard } from "./gig-card";
import type { GigCard as GigCardData } from "@/modules/catalog/contracts";

export function GigGrid({ gigs }: { gigs: GigCardData[] }) {
  if (gigs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-semibold text-heading">No gigs match your search</p>
        <p className="mt-1 text-sm text-muted-foreground">Try a different keyword or clear the filters.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {gigs.map((gig, i) => (
        <li key={gig.id} className="anim-stagger" style={{ "--i": i } as React.CSSProperties}>
          <GigCard gig={gig} />
        </li>
      ))}
    </ul>
  );
}
