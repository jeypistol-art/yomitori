"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-6 text-[#1f2933]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
          YOMITORI DocuTask
        </p>
        <h1 className="mt-2 text-2xl font-bold">ログイン</h1>
        <p className="mt-3 text-sm leading-6 text-[#4b5563]">
          Googleアカウントでログインします。
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="mt-6 w-full rounded-md bg-[#2f5d50] px-4 py-3 text-sm font-bold text-white hover:bg-[#24483e]"
        >
          Googleでログイン
        </button>
      </section>
    </main>
  );
}

