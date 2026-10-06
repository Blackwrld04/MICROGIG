"use client";

import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";

/**
 * Raw deliverable download — DEL-05: GET /api/v1/deliveries/:fileKey/download returns a
 * 15-minute presigned URL, which the browser then opens.
 * Needs the delivery's storage key from the order workspace; until the backend includes it,
 * the button is disabled with an explanation rather than silently doing nothing.
 */
export function DownloadButton({ fileName, storageKey }: { fileName: string; storageKey: string | null | undefined }) {
  const download = useMutation({
    mutationFn: async () => {
      if (USE_MOCKS) return null;
      return api<{ downloadUrl: string }>(`/deliveries/${encodeURIComponent(storageKey!)}/download`);
    },
    onSuccess: (res) => {
      if (!res) return toast("Demo mode: there's no real file to download.", "info");
      window.location.assign(res.downloadUrl);
    },
    onError: (err) => toast(err instanceof Error ? err.message : "The download couldn't start. Please try again.", "danger"),
  });

  const unavailable = !USE_MOCKS && !storageKey;
  return (
    <div className="space-y-1">
      <Button variant="outline" size="sm" type="button" disabled={unavailable || download.isPending} onClick={() => download.mutate()}>
        <Download aria-hidden /> {download.isPending ? "Preparing download…" : `Download ${fileName}`}
      </Button>
      {unavailable ? <p className="text-xs text-muted-foreground">The download link isn&apos;t available for this file yet.</p> : null}
    </div>
  );
}
