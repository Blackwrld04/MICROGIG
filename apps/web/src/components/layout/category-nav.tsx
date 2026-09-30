import Link from "next/link";
import { CATEGORIES } from "@/lib/constants/categories";

/** Category bar — PRD §16.1 / GIG-12. Scrolls horizontally on small screens. */
export function CategoryNav() {
  return (
    <nav aria-label="Categories" className="border-t border-border">
      <ul className="container flex gap-6 overflow-x-auto py-2.5 text-sm">
        {CATEGORIES.map((c) => (
          <li key={c.slug} className="shrink-0">
            <Link
              href={`/categories/${c.slug}`}
              className="text-muted-foreground hover:text-heading hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-8"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
