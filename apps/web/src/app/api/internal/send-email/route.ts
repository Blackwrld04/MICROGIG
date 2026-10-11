import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. Verify internal secret authentication
  const expectedSecret = process.env.INTERNAL_EMAIL_SECRET || process.env.COOKIE_SECRET;
  const providedSecret = request.headers.get("x-internal-secret");

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: invalid or missing internal secret" },
      { status: 401 }
    );
  }

  // 2. Parse payload
  let body: { to?: string; subject?: string; html?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, html, text } = body;
  if (!to || !subject || !html) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: to, subject, html" },
      { status: 422 }
    );
  }

  // 3. Obtain SMTP credentials
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { ok: false, error: "SMTP credentials (SMTP_USER / SMTP_PASS) not configured on frontend" },
      { status: 503 }
    );
  }

  const isGmail = Boolean(
    (smtpHost && smtpHost.toLowerCase().includes("gmail.com")) ||
    (smtpUser && smtpUser.toLowerCase().includes("@gmail.com"))
  );

  const transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: "gmail",
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        }
  );

  try {
    const fromAddress = process.env.EMAIL_FROM || `MicroGig <${smtpUser}>`;
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " ").trim(),
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("[internal/send-email] SMTP delivery failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
