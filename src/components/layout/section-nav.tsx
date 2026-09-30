"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Side navigation for settings / admin sections. */
export function SectionNav({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-semibold",
                  active ? "bg-heading text-white" : "text-heading hover:bg-surface",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
