import * as React from "react";
import { Label } from "./label";

/**
 * Label + control + hint + error, wired together with ids so screen readers announce
 * hints and errors (aria-describedby / aria-invalid). The control is passed as a render prop.
 */
export function Field({
  id,
  label,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {counter ? <span className="text-xs tabular-nums text-muted-foreground">{counter}</span> : null}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
