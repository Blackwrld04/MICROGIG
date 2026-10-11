import dns from "node:dns";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { env } from "../env.js";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const isGmail = Boolean(
  (env.SMTP_HOST && env.SMTP_HOST.toLowerCase().includes("gmail.com")) ||
  (env.SMTP_USER && env.SMTP_USER.toLowerCase().includes("@gmail.com"))
);

const smtpTransporter = (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
  ? nodemailer.createTransport(
      isGmail
        ? {
            service: "gmail",
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS.replace(/\s+/g, ""),
            },
          }
        : {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465 || env.SMTP_SECURE,
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS.replace(/\s+/g, ""),
            },
          }
    )
  : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type EmailResult =
  | { status: "sent"; id?: string }
  /** No provider configured. Outside production the message is logged instead. */
  | { status: "not_configured" }
  | { status: "failed"; error: string };

export function emailConfigured() {
  const relaySecret = env.INTERNAL_EMAIL_SECRET || env.COOKIE_SECRET;
  const relayUrl =
    env.INTERNAL_EMAIL_PROXY_URL ||
    (env.WEB_ORIGIN && !env.WEB_ORIGIN.includes("localhost")
      ? `${env.WEB_ORIGIN.replace(/\/+$/, "")}/api/internal/send-email`
      : null);

  return Boolean(resend || (relayUrl && relaySecret) || smtpTransporter);
}

/** Sends one email and reports what happened, so callers can tell the user or retry. */
export async function sendTransactionalEmail(options: SendEmailOptions): Promise<EmailResult> {
  // 1. Resend API
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      if (error) return { status: "failed", error: error.message ?? String(error) };
      return { status: "sent", id: data?.id };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  // 2. HTTPS Relay (for environments like Render Free where outbound ports 465/587 are blocked)
  const relaySecret = env.INTERNAL_EMAIL_SECRET || env.COOKIE_SECRET;
  const relayUrl =
    env.INTERNAL_EMAIL_PROXY_URL ||
    (env.WEB_ORIGIN && !env.WEB_ORIGIN.includes("localhost")
      ? `${env.WEB_ORIGIN.replace(/\/+$/, "")}/api/internal/send-email`
      : null);

  if (relayUrl && relaySecret) {
    try {
      const response = await fetch(relayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": relaySecret,
        },
        body: JSON.stringify(options),
        signal: AbortSignal.timeout(12000),
      });

      const data = await response.json().catch(() => null) as { ok?: boolean; messageId?: string; error?: string } | null;
      if (response.ok && data?.ok) {
        console.log(`[email] Sent via HTTPS relay (${relayUrl}): ${data.messageId}`);
        return { status: "sent", id: data.messageId };
      }

      console.warn(`[email] Relay returned ${response.status}:`, data?.error || "Unknown relay error");
      // If relay returned 401/404/503, try direct SMTP fallback below if configured
    } catch (relayErr) {
      console.warn("[email] HTTPS relay network error:", relayErr instanceof Error ? relayErr.message : String(relayErr));
    }
  }

  // 3. Direct SMTP (e.g. Local dev, or Render paid plans where ports 465/587 are open)
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: env.EMAIL_FROM || env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return { status: "sent", id: info.messageId };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  // 4. No provider. Development logs the email so flows can be tested locally.
  if (env.NODE_ENV !== "production") {
    console.log(`[Email Simulation] To: ${options.to} | Subject: "${options.subject}"
${options.text ?? ""}`);
  }
  return { status: "not_configured" };
}
