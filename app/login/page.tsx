"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const attemptedTokenLogin = useRef(false);

  function getCallbackUrl() {
    if (typeof window === "undefined") {
      return "/dashboard";
    }
    const value = new URLSearchParams(window.location.search).get("callbackUrl");
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
      return "/dashboard";
    }
    return value;
  }

  useEffect(() => {
    if (attemptedTokenLogin.current) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const loginEmail = params.get("email");
    if (loginEmail) {
      setEmail(loginEmail);
    }
    if (!token || !loginEmail) {
      return;
    }

    attemptedTokenLogin.current = true;
    setVerifying(true);
    setError("");
    setMessage("ログインリンクを確認しています。");
    void signIn("email-link", {
      redirect: false,
      email: loginEmail,
      token,
      callbackUrl: getCallbackUrl(),
    }).then((result) => {
      if (result?.ok) {
        window.location.assign(result.url ?? getCallbackUrl());
        return;
      }
      setVerifying(false);
      setMessage("");
      setError("ログインリンクが無効、または有効期限が切れています。");
    }).catch(() => {
      setVerifying(false);
      setMessage("");
      setError("ログインリンクの確認に失敗しました。時間を置いて再度お試しください。");
    });
  }, []);

  async function requestEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/auth/email-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackUrl: getCallbackUrl() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: { expires_in_minutes?: number };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "ログインメールの送信に失敗しました。");
      }
      setMessage(
        `ログインリンクを送信しました。${payload.data?.expires_in_minutes ?? 15}分以内にメールを確認してください。`
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ログインメールの送信に失敗しました。"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-6 text-[#1f2933]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
          YOMITORI DocuTask
        </p>
        <h1 className="mt-2 text-2xl font-bold">ログイン</h1>
        <p className="mt-3 text-sm leading-6 text-[#4b5563]">
          Googleアカウント、またはメールでログインできます。
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: getCallbackUrl() })}
          className="mt-6 w-full rounded-md bg-[#2f5d50] px-4 py-3 text-sm font-bold text-white hover:bg-[#24483e]"
        >
          Googleでログイン
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#e1e6dc]" />
          <span className="text-xs font-bold text-[#6b7280]">または</span>
          <div className="h-px flex-1 bg-[#e1e6dc]" />
        </div>

        <form onSubmit={requestEmailLink} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-[#1f2933]">
              メールアドレス
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-md border border-[#cfd6ca] px-3 py-3 text-sm outline-none focus:border-[#2f5d50]"
            />
          </label>
          <button
            type="submit"
            disabled={sending || verifying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 py-3 text-sm font-bold text-[#2f5d50] hover:bg-[#eef2eb] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            メールでログイン
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-md bg-[#edf7ef] px-3 py-2 text-sm font-semibold text-[#2f5d50]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md bg-[#fff1f0] px-3 py-2 text-sm font-semibold text-[#9f352c]">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
