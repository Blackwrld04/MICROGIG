import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark size={48} />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Button asChild>
        <Link href="/gigs">Browse gigs</Link>
      </Button>
    </main>
  );
}
