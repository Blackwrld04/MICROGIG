"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { LEAKAGE_WARNING, detectContactLeakage } from "@/modules/messaging/leakage";
import type { OrderMessage, ViewerRole } from "@/modules/orders/types";

const MAX_ATTACHMENT = 10 * 1024 * 1024; // MSG-01

/**
 * Order-scoped async thread — MSG-01 / MSG-03.
 * TODO: poll GET /api/v1/orders/:id/messages every 15 s (pause when the tab is hidden).
 */
export function MessageThread({
  messages,
  viewerRole,
  viewerName,
  onSend,
  disabled,
}: {
  messages: OrderMessage[];
  viewerRole: ViewerRole;
  viewerName: string;
  onSend: (m: OrderMessage) => void;
  disabled?: boolean;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [confirmLeak, setConfirmLeak] = useState(false);

  function send(force = false) {
    if (!body.trim() && !file) return setError("Write a message or attach a file");
    if (!force && detectContactLeakage(body)) return setConfirmLeak(true); // warn only, never block
    onSend({
      id: `msg-${Date.now()}`,
      senderRole: viewerRole,
      senderName: viewerName,
      body: body.trim(),
      attachmentName: file?.name ?? null,
      createdAt: new Date().toISOString(),
    });
    setBody("");
    setFile(null);
    setError(undefined);
    setConfirmLeak(false);
  }

  return (
    <div className="space-y-4">
      <Alert variant="warning">Keep payments and communication on the platform.</Alert>

      <ol className="space-y-3" aria-label="Messages">
        {messages.length === 0 ? <li className="text-sm text-muted-foreground">No messages yet.</li> : null}
        {messages.map((m) => {
          const mine = m.senderRole === viewerRole;
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-lg px-4 py-2.5 text-sm", mine ? "bg-heading text-white" : "bg-surface text-heading")}>
                <p className="text-xs font-semibold opacity-90">{mine ? "You" : m.senderName}</p>
                {m.body ? <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p> : null}
                {m.attachmentName ? (
                  <p className="mt-1 flex items-center gap-1 text-xs underline">
                    <Paperclip className="h-3 w-3" aria-hidden /> {m.attachmentName}
                  </p>
                ) : null}
                <time dateTime={m.createdAt} className="mt-1 block text-[11px] opacity-90">
                  {formatDateTime(m.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>

      {disabled ? (
        <p className="text-sm text-muted-foreground">This conversation is closed.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="space-y-2"
        >
          <label htmlFor="message-body" className="sr-only">
            Message
          </label>
          <Textarea
            id="message-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setConfirmLeak(false);
            }}
            placeholder="Write a message…"
            aria-describedby={error ? "message-error" : undefined}
          />
          {error ? (
            <p id="message-error" className="text-xs font-semibold text-red-700">
              {error}
            </p>
          ) : null}
          {confirmLeak ? (
            <Alert variant="danger" title="This looks like contact details">
              <p>{LEAKAGE_WARNING}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setConfirmLeak(false)}>
                  Edit message
                </Button>
                <Button size="sm" variant="dark" type="button" onClick={() => send(true)}>
                  Send anyway
                </Button>
              </div>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-heading">
              <Paperclip className="h-4 w-4" aria-hidden />
              {file ? `${file.name} (${formatBytes(file.size)})` : "Attach file (max 10 MB)"}
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_ATTACHMENT) {
                    setError("Attachments are limited to 10 MB");
                    return;
                  }
                  setError(undefined);
                  setFile(f);
                }}
              />
            </label>
            <Button type="submit">
              <Send aria-hidden /> Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
