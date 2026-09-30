"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { loginSchema, registerSchema } from "@/modules/auth/contracts";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least 1 number", test: (p: string) => /\d/.test(p) },
  { label: "At least 1 symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Sign in — AUTH-02. TODO: POST /api/v1/auth/login (cookies set by the server; 429 → show retry message). */
export function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    await new Promise((r) => setTimeout(r, 400));
    router.push("/gigs");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="login-email" label="Email" error={errors.email}>
        {(p) => (
          <Input {...p} type="email" autoComplete="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
        )}
      </Field>
      <Field id="login-password" label="Password" error={errors.password}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          />
        )}
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm">
        New to microgig?{" "}
        <Link href="/register" className="font-semibold text-heading underline">
          Join now
        </Link>
      </p>
    </form>
  );
}

/** Register — AUTH-01. TODO: POST /api/v1/auth/register. */
export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    await new Promise((r) => setTimeout(r, 400));
    router.push("/gigs");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="reg-name" label="Full name" error={errors.fullName}>
        {(p) => <Input {...p} autoComplete="name" value={values.fullName} onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))} />}
      </Field>
      <Field id="reg-email" label="Email" error={errors.email}>
        {(p) => (
          <Input {...p} type="email" autoComplete="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
        )}
      </Field>
      <Field id="reg-password" label="Password" error={errors.password}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          />
        )}
      </Field>
      <ul className="space-y-1 text-xs" aria-label="Password requirements">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(values.password);
          return (
            <li key={r.label} className={cn("flex items-center gap-1.5", ok ? "text-emerald-800" : "text-muted-foreground")}>
              {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
              {r.label}
              <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
            </li>
          );
        })}
      </ul>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-heading underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function DemoAuthNotice() {
  return <Alert variant="info">Demo mode: any valid email and password will sign you in as the sample user.</Alert>;
}
