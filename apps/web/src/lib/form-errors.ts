import type { ZodError } from "zod";

/** Flattens a ZodError into { "path.to.field": "message" } (first message per field). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
