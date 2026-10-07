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
  return Boolean(resend || smtpTransporter);
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

  // 2. SMTP (e.g. Gmail App Password, SendGrid SMTP, Mailgun)
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

  // 3. No provider. Development logs the email so flows can be tested locally.
  if (env.NODE_ENV !== "production") {
    console.log(`[Email Simulation] To: ${options.to} | Subject: "${options.subject}"
${options.text ?? ""}`);
  }
  return { status: "not_configured" };
}
