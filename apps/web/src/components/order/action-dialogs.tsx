"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Confirmation for irreversible actions (accept, cancel). */
export function ConfirmDialog({
  trigger,
  triggerVariant = "default",
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: string;
  triggerVariant?: ButtonProps["variant"];
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Go back
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Free-text reason with a minimum length: revision feedback (≥ 20, T-07) or dispute reason (≥ 50, T-09). */
export function ReasonDialog({
  trigger,
  triggerVariant = "outline",
  title,
  description,
  label,
  minLength,
  confirmLabel,
  onSubmit,
}: {
  trigger: string;
  triggerVariant?: ButtonProps["variant"];
  title: string;
  description: string;
  label: string;
  minLength: number;
  confirmLabel: string;
  onSubmit: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const length = text.trim().length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (length < minLength) return setError(`Please write at least ${minLength} characters`);
            onSubmit(text.trim());
            setText("");
            setOpen(false);
          }}
        >
          <Field id="reason-text" label={label} counter={`${length} / ${minLength} min`} error={error}>
            {(props) => <Textarea {...props} value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{confirmLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Post-completion review — REV-01: 1–5 stars, optional text ≤ 500 chars. */
export function ReviewDialog({ onSubmit }: { onSubmit: (rating: number, body: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Leave a review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>How did it go?</DialogTitle>
        <DialogDescription>Your rating helps other buyers. You can review within 14 days of completion.</DialogDescription>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating < 1) return setError("Choose a star rating");
            onSubmit(rating, body.trim() || null);
            setOpen(false);
          }}
        >
          <fieldset>
            <legend className="text-sm font-semibold text-heading">Rating</legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    onChange={() => {
                      setRating(n);
                      setError(undefined);
                    }}
                    className="peer sr-only"
                  />
                  <span className="sr-only">
                    {n} {n === 1 ? "star" : "stars"}
                  </span>
                  <Star
                    aria-hidden
                    className={cn(
                      "h-8 w-8 rounded text-heading peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                      n <= rating ? "fill-heading" : "fill-none",
                    )}
                  />
                </label>
              ))}
            </div>
            {error ? <p className="mt-1 text-xs font-semibold text-red-700">{error}</p> : null}
          </fieldset>
          <Field id="review-body" label="Review (optional)" counter={`${body.length} / 500`}>
            {(props) => <Textarea {...props} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit">Submit review</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
