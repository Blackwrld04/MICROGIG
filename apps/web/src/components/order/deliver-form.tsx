"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/money";
import type { OrderDelivery } from "@/modules/orders/types";

const MAX_BYTES = 50 * 1024 * 1024; // DEL-03
const MIN_BYTES = 100; // §14.1 content-length-range lower bound
const ALLOWED: Record<string, OrderDelivery["kind"]> = {
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "application/pdf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "text/plain": "document",
};

type NewDelivery = Omit<OrderDelivery, "id" | "sequenceNo" | "createdAt">;

/**
 * Seller delivery — ORD-04 / DEL-01..03. Client checks mirror the server policy
 * (type + size); the server still verifies via HeadObject + magic bytes.
 * TODO: POST /deliveries/presign-upload → PUT to S3 → POST /orders/:id/deliveries { fileKey, notes }.
 */
export function DeliverForm({ onDeliver }: { onDeliver: (d: NewDelivery) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [fileError, setFileError] = useState<string>();
  const [notesError, setNotesError] = useState<string>();

  function pick(f: File | null) {
    setFile(null);
    setFileError(undefined);
    if (!f) return;
    if (!ALLOWED[f.type]) return setFileError("Use ZIP, PNG, JPG, WEBP, PDF, DOCX or TXT.");
    if (f.size > MAX_BYTES) return setFileError(`File is ${formatBytes(f.size)}; the limit is 50 MB.`);
    if (f.size < MIN_BYTES) return setFileError("File looks empty.");
    setFile(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = notes.trim() ? undefined : "Add a short note about what you delivered";
    setNotesError(nErr);
    if (!file) setFileError((prev) => prev ?? "Choose a file to deliver");
    if (!file || nErr) return;
    const kind = ALLOWED[file.type]!;
    onDeliver({
      fileName: file.name,
      fileSize: file.size,
      kind,
      notes: notes.trim(),
      // Computed server-side after upload; placeholder in demo mode.
      sha256: "pending-server-verification",
      fileTree: kind === "archive" ? ["(file tree generated after upload)"] : null,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-base font-semibold">Deliver completed work</h3>
      <Field id="delivery-file" label="Deliverable file" hint="Max 50 MB. ZIP, PNG, JPG, WEBP, PDF, DOCX or TXT." error={fileError}>
        {(props) => (
          <input
            {...props}
            type="file"
            accept=".zip,.png,.jpg,.jpeg,.webp,.pdf,.docx,.txt"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-heading"
          />
        )}
      </Field>
      {file ? (
        <p className="text-sm">
          Selected: <span className="font-semibold text-heading">{file.name}</span> ({formatBytes(file.size)})
        </p>
      ) : null}
      <Field id="delivery-notes" label="Delivery notes" error={notesError}>
        {(props) => <Textarea {...props} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <Button type="submit">
        <Upload aria-hidden /> Deliver work
      </Button>
    </form>
  );
}
