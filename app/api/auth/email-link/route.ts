import { NextResponse } from "next/server";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { escapeHtml, sendEmail } from "@/lib/email_delivery";
import {
  createEmailLoginToken,
  normalizeLoginEmail,
} from "@/lib/email_login_tokens";

export const dynamic = "force-dynamic";

type EmailLinkRequest = {
  email?: unknown;
  callbackUrl?: unknown;
};

function resolveBaseUrl(request: Request) {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

function normalizeCallbackUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "/dashboard";
  }
  const callbackUrl = value.trim();
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/dashboard";
  }
  return callbackUrl;
}

function buildLoginEmail(args: {
  email: string;
  loginUrl: string;
  expiresInMinutes: number;
}) {
  const safeUrl = escapeHtml(args.loginUrl);
  const safeEmail = escapeHtml(args.email);
  const subject = "YOMITORI DocuTask ログインリンク";
  const text = [
    "YOMITORI DocuTaskへのログインリンクを発行しました。",
    "",
    `ログイン: ${args.loginUrl}`,
    "",
    `このリンクは${args.expiresInMinutes}分間だけ有効です。`,
    "心当たりがない場合、このメールは破棄してください。",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1f2933">
      <p>YOMITORI DocuTaskへのログインリンクを発行しました。</p>
      <p>
        <a href="${safeUrl}" style="display:inline-block;background:#2f5d50;color:#fff;padding:12px 18px;text-decoration:none;font-weight:700">
          ログインする
        </a>
      </p>
      <p style="font-size:13px;color:#4b5563">
        宛先: ${safeEmail}<br>
        このリンクは${args.expiresInMinutes}分間だけ有効です。
      </p>
      <p style="font-size:13px;color:#4b5563">
        心当たりがない場合、このメールは破棄してください。
      </p>
    </div>
  `;

  return { subject, text, html };
}

async function readJson(request: Request): Promise<EmailLinkRequest> {
  return request.json().catch(() => ({}));
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    let email: string;
    try {
      email = normalizeLoginEmail(body.email);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "メールアドレスを確認してください。"
      );
    }

    const callbackUrl = normalizeCallbackUrl(body.callbackUrl);
    const { token, expiresInMinutes } = await createEmailLoginToken(email);
    const loginUrl = new URL("/login", resolveBaseUrl(request));
    loginUrl.searchParams.set("email", email);
    loginUrl.searchParams.set("token", token);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);

    const emailBody = buildLoginEmail({
      email,
      loginUrl: loginUrl.toString(),
      expiresInMinutes,
    });
    await sendEmail({
      to: email,
      subject: emailBody.subject,
      text: emailBody.text,
      html: emailBody.html,
    });

    return NextResponse.json({
      data: {
        sent: true,
        expires_in_minutes: expiresInMinutes,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("送信回数が多すぎます")
    ) {
      return jsonApiError(new ApiError(429, error.message));
    }
    return jsonApiError(error);
  }
}
