"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** Route-level error boundary: friendly message + retry. Details stay in the console, not the UI. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container flex flex-col items-center gap-4 py-20 text-center" role="alert">
      <LogoMark size={48} />
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t load this page. Please try again. If it keeps happening, come back in a few minutes.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/gigs">Browse gigs</Link>
        </Button>
      </div>
    </div>
  );
}
