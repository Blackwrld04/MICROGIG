import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="container flex h-16 items-center">
        <Link href="/gigs" aria-label="microgig home">
          <Logo />
        </Link>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
