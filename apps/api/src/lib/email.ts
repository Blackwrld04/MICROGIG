import { Resend } from "resend";
import nodemailer from "nodemailer";
import { env } from "../env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const smtpTransporter = (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS.replace(/\s+/g, ""),
      },
    })
  : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendTransactionalEmail(options: SendEmailOptions) {
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

      if (error) {
        console.error("[Resend Email Error]:", error);
        return null;
      }
      return data;
    } catch (err) {
      console.error("[Resend Error Exception]:", err);
      return null;
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
      console.log(`[SMTP Email Sent] MessageId: ${info.messageId} to ${options.to}`);
      return info;
    } catch (err) {
      console.error("[SMTP Error Exception]:", err);
      return null;
    }
  }

  // 3. Fallback: Simulation in development
  if (env.NODE_ENV !== "production") {
    console.log(`[Email Simulation] To: ${options.to} | Subject: "${options.subject}"`);
  }
  return { id: "simulated-email-id" };
}
