import { Download, FileArchive, FileText, ImageIcon, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/money";
import { formatRelative } from "@/lib/time";
import type { OrderDelivery } from "@/modules/orders/types";

function FileTree({ paths }: { paths: string[] }) {
  return (
    <ul className="space-y-0.5 font-mono text-xs" aria-label="Archive contents">
      {paths.map((p, i) => (
        <li key={p}>
          <span aria-hidden className="text-muted-foreground">
            {i === paths.length - 1 ? "└── " : "├── "}
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

/**
 * One delivery — DEL-05/06/07. Before COMPLETED the raw file stays locked: images show a
 * watermarked preview; archives/documents show name, size, SHA-256 and a file tree.
 */
export function DeliveryCard({
  delivery,
  unlocked,
  nowMs,
}: {
  delivery: OrderDelivery;
  unlocked: boolean;
  nowMs: number;
}) {
  const Icon = delivery.kind === "image" ? ImageIcon : delivery.kind === "archive" ? FileArchive : FileText;

  return (
    <article className="space-y-4 rounded-lg border border-border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Delivery #{delivery.sequenceNo}</h3>
        <time dateTime={delivery.createdAt} className="text-xs text-muted-foreground">
          Uploaded {formatRelative(delivery.createdAt, nowMs).toLowerCase()}
        </time>
      </header>
      <p className="text-sm">
        <span className="font-semibold text-heading">Note:</span> {delivery.notes}
      </p>

      {delivery.kind === "image" && !unlocked ? (
        <div
          className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-md bg-surface"
          role="img"
          aria-label={`Watermarked preview of ${delivery.fileName}`}
        >
          <ImageIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
          <span
            aria-hidden
            className="pointer-events-none absolute -rotate-[30deg] select-none whitespace-nowrap text-lg font-bold uppercase tracking-wider text-heading/25 md:text-2xl"
          >
            microgig preview • unaccepted deliverable
          </span>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-md bg-surface p-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-heading" aria-hidden />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold text-heading">
            {delivery.fileName} <span className="font-normal text-muted-foreground">({formatBytes(delivery.fileSize)})</span>
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">SHA-256: {delivery.sha256}</p>
          {delivery.fileTree ? (
            <div className="pt-1">
              <p className="text-xs font-semibold text-heading">Contents preview:</p>
              <FileTree paths={delivery.fileTree} />
            </div>
          ) : null}
        </div>
      </div>

      {unlocked ? (
        <Button variant="outline" size="sm" type="button">
          <Download aria-hidden /> Download {delivery.fileName}
        </Button>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Raw download unlocks when the order is completed.
        </p>
      )}
    </article>
  );
}
