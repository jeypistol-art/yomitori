import { createHash, randomBytes } from "crypto";
import { query } from "@/lib/db";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MINUTES = 10;

export function normalizeLoginEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("メールアドレスを入力してください。");
  }
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new Error("有効なメールアドレスを入力してください。");
  }
  return email;
}

function hashToken(token: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return createHash("sha256").update(`${token}:${secret}`).digest("hex");
}

export async function createEmailLoginToken(email: string) {
  await query(
    `DELETE FROM email_login_tokens
     WHERE expires_at < now() - interval '1 day'
        OR used_at < now() - interval '1 day'`
  );

  const recent = await query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM email_login_tokens
     WHERE email = $1
       AND created_at > now() - ($2::int * interval '1 minute')`,
    [email, REQUEST_WINDOW_MINUTES]
  );
  if (Number(recent.rows[0]?.count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error("ログインメールの送信回数が多すぎます。少し時間を置いてください。");
  }

  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO email_login_tokens (email, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3::int * interval '1 minute'))`,
    [email, hashToken(token), TOKEN_TTL_MINUTES]
  );

  return {
    token,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  };
}

export async function consumeEmailLoginToken(email: string, token: string) {
  if (!token || token.length > 200) {
    return false;
  }

  const result = await query<{ id: string }>(
    `UPDATE email_login_tokens
     SET used_at = now()
     WHERE email = $1
       AND token_hash = $2
       AND used_at IS NULL
       AND expires_at > now()
     RETURNING id`,
    [email, hashToken(token)]
  );

  return result.rows.length > 0;
}
