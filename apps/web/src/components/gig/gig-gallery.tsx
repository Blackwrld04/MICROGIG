"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gig media gallery — GIG-07: 1 primary + up to 3 showcase images. */
export function GigGallery({ images, title }: { images: (string | null)[]; title: string }) {
  const [active, setActive] = useState(0);
  const slots = images.length > 0 ? images : [null];

  const render = (src: string | null, sizes: string, label: string) =>
    src ? (
      <Image src={src} alt={label} fill sizes={sizes} className="object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground" role="img" aria-label={label}>
        <ImageIcon className="h-10 w-10" aria-hidden />
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border bg-surface">
        {render(slots[active] ?? null, "(min-width: 1024px) 60vw, 100vw", `${title}, image ${active + 1} of ${slots.length}`)}
      </div>
      {slots.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {slots.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative aspect-[16/10] overflow-hidden rounded-md border-2 bg-surface",
                i === active ? "border-heading" : "border-transparent",
              )}
            >
              {src ? (
                <Image src={src} alt="" fill sizes="15vw" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" aria-hidden />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
