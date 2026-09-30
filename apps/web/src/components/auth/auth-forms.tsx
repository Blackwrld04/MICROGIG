"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, Laptop, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api/client";
import { fieldErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { homeFor, loginSchema, registerSchema, type AccountType, type Me, type RegisterInput } from "@/modules/auth/contracts";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least 1 number", test: (p: string) => /\d/.test(p) },
  { label: "At least 1 symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Only allow same-site relative redirects after sign-in (no open redirect). */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function apiFieldErrors(err: unknown): { message: string; fields: Record<string, string> } {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { fieldErrors?: Record<string, string> } } | undefined;
    return { message: err.message, fields: body?.error?.fieldErrors ?? {} };
  }
  return { message: "Something went wrong. Please try again.", fields: {} };
}

/** Sign in — AUTH-02. Session cookies are set by the server (HttpOnly, AUTH-03). */
export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<{ user: Me }>("/auth/login", { method: "POST", body: credentials }),
    onMutate: () => setFormError(undefined),
    onSuccess: ({ user }) => {
      queryClient.clear(); // never show the previous account's cached data
      router.push(safeNext(next) ?? homeFor(user));
      router.refresh();
    },
    onError: (err) => {
      const { message, fields } = apiFieldErrors(err);
      setErrors(fields);
      setFormError(message);
    },
  });
  // Stay "pending" through the redirect so the buttons don't re-enable mid-navigation.
  const pending = login.isPending || login.isSuccess;

  function signIn(email: string, password: string) {
    login.mutate({ email, password });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void signIn(parsed.data.email, parsed.data.password);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? <Alert variant="danger">{formError}</Alert> : null}
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
      </form>

      {showDemo ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-semibold text-heading">Try a demo account</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => signIn("alice@example.com", "demo")}>
              Client
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => signIn("alex@example.com", "demo")}>
              Freelancer
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => signIn("admin@microgig.dev", "demo")}>
              Admin
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-center text-sm">
        New to microgig?{" "}
        <Link href="/register" className="font-semibold text-heading underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

const ACCOUNT_OPTIONS: { value: AccountType; title: string; description: string; Icon: typeof Briefcase }[] = [
  {
    value: "CLIENT",
    title: "I'm a client",
    description: "I want to hire freelancers for small, fixed-price jobs.",
    Icon: Briefcase,
  },
  {
    value: "FREELANCER",
    title: "I'm a freelancer",
    description: "I want to sell my skills as fixed-price micro-gigs.",
    Icon: Laptop,
  },
];

/** Register — AUTH-01. The account type is chosen here once and can't be changed later. */
export function RegisterForm({ initialType, next }: { initialType?: AccountType; next?: string }) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType | undefined>(initialType);
  const [values, setValues] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const queryClient = useQueryClient();

  const register = useMutation({
    mutationFn: (input: RegisterInput) => api<{ user: Me }>("/auth/register", { method: "POST", body: input }),
    onMutate: () => setFormError(undefined),
    onSuccess: ({ user }) => {
      queryClient.clear();
      // A freelancer's `next` (e.g. a checkout link) doesn't apply: send them to onboarding.
      router.push(user.accountType === "CLIENT" ? (safeNext(next) ?? homeFor(user)) : homeFor(user));
      router.refresh();
    },
    onError: (err) => {
      const { message, fields } = apiFieldErrors(err);
      setErrors(fields);
      setFormError(message);
    },
  });
  const pending = register.isPending || register.isSuccess;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse({ ...values, accountType });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    register.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError ? <Alert variant="danger">{formError}</Alert> : null}

      <fieldset aria-describedby="account-type-note">
        <legend className="text-sm font-semibold text-heading">How will you use microgig?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {ACCOUNT_OPTIONS.map(({ value, title, description, Icon }) => {
            const checked = accountType === value;
            return (
              <label
                key={value}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-lg border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-ring",
                  checked ? "border-heading bg-surface" : "border-border hover:border-heading/40",
                )}
              >
                <input
                  type="radio"
                  name="accountType"
                  value={value}
                  checked={checked}
                  onChange={() => setAccountType(value)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-heading" aria-hidden />
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2",
                      checked ? "border-heading bg-heading text-white" : "border-border",
                    )}
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                </span>
                <span className="font-semibold text-heading">{title}</span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </label>
            );
          })}
        </div>
        <p id="account-type-note" className="mt-2 text-xs text-muted-foreground">
          You can&apos;t switch later: an account is either a client or a freelancer.
        </p>
        {errors.accountType ? <p className="mt-1 text-xs font-semibold text-red-700">{errors.accountType}</p> : null}
      </fieldset>

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
        {pending
          ? "Creating account…"
          : accountType === "FREELANCER"
            ? "Create freelancer account"
            : accountType === "CLIENT"
              ? "Create client account"
              : "Create account"}
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
