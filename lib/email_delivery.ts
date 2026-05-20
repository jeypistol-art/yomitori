export type SendEmailArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
};

export type SendEmailResult = {
  provider: "resend" | "smtp" | "log";
  messageId: string | null;
};

export function getDeliveryMode() {
  const mode = process.env.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
  if (mode === "log" || mode === "send") {
    return mode;
  }
  return process.env.NODE_ENV === "production" ? "send" : "log";
}

function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "YOMITORI DocuTask <no-reply@yomitori.local>";
}

function requireEmailFrom() {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    throw new Error("EMAIL_FROM is required for email delivery");
  }
  return from;
}

function getSmtpPort() {
  const port = Number(process.env.EMAIL_SERVER_PORT);
  return Number.isInteger(port) && port > 0 ? port : 587;
}

function hasSmtpConfig() {
  return Boolean(
    process.env.EMAIL_SERVER_HOST?.trim() &&
      process.env.EMAIL_SERVER_USER?.trim() &&
      process.env.EMAIL_SERVER_PASSWORD?.trim()
  );
}

export function getEmailDeliveryStatus() {
  const mode = getDeliveryMode();
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const smtpConfigured = hasSmtpConfig();
  const from = getEmailFrom();
  const provider =
    mode === "log"
      ? "log"
      : resendConfigured
        ? "resend"
        : smtpConfigured
          ? "smtp"
          : "unconfigured";

  return {
    mode,
    provider,
    from,
    from_configured: Boolean(process.env.EMAIL_FROM?.trim()),
    resend_configured: resendConfigured,
    smtp_configured: smtpConfigured,
  };
}

async function sendWithResend(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required for Resend delivery");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: requireEmailFrom(),
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      reply_to: args.replyTo || undefined,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message || `Resend delivery failed: ${response.status}`);
  }

  return {
    provider: "resend",
    messageId: payload.id ?? null,
  };
}

async function sendWithSmtp(args: SendEmailArgs): Promise<SendEmailResult> {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP email settings are incomplete");
  }

  const nodemailer = await import("nodemailer");
  const port = getSmtpPort();
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
  const info = await transporter.sendMail({
    from: requireEmailFrom(),
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: args.replyTo || undefined,
  });

  return {
    provider: "smtp",
    messageId: typeof info.messageId === "string" ? info.messageId : null,
  };
}

function logEmail(args: SendEmailArgs): SendEmailResult {
  console.info("[email:log]", {
    from: getEmailFrom(),
    to: args.to,
    subject: args.subject,
  });
  return {
    provider: "log",
    messageId: null,
  };
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (getDeliveryMode() === "log") {
    return logEmail(args);
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendWithResend(args);
  }

  if (hasSmtpConfig()) {
    return sendWithSmtp(args);
  }

  throw new Error("Email delivery provider is not configured");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
