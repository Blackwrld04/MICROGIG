import { Resend } from "resend";
import { env } from "../env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendTransactionalEmail(options: SendEmailOptions) {
  if (!resend) {
    if (env.NODE_ENV !== "production") {
      console.log(`[Email Simulation] To: ${options.to} | Subject: "${options.subject}"`);
    }
    return { id: "simulated-email-id" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error("[Email Error]:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[Email Error Exception]:", err);
    return null;
  }
}
