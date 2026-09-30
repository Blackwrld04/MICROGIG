import Link from "next/link";
import { cn } from "@/lib/utils";

export function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
        active ? "border-heading bg-heading text-white" : "border-border text-heading hover:border-heading",
      )}
    >
      {children}
    </Link>
  );
}
