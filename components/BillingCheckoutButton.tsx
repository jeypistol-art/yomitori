"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type BillingCheckoutButtonProps = {
  endpoint: "/api/billing/checkout" | "/api/billing/extra-pack-checkout";
  payload: Record<string, string>;
  children: ReactNode;
  className: string;
  disabled?: boolean;
  confirmMessage?: string;
  loadingLabel?: string;
};

type CheckoutResponse = {
  data?: {
    checkout_url?: string | null;
    redirect_url?: string | null;
  };
  error?: string;
};

export default function BillingCheckoutButton({
  endpoint,
  payload,
  children,
  className,
  disabled = false,
  confirmMessage,
  loadingLabel = "処理中",
}: BillingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (!response.ok) {
        throw new Error(result.error || "決済ページを作成できませんでした");
      }
      const redirectUrl = result.data?.checkout_url ?? result.data?.redirect_url;
      if (!redirectUrl) {
        throw new Error("遷移先URLを取得できませんでした");
      }
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "決済ページを作成できませんでした");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled || loading}
        className={className}
      >
        {loading ? loadingLabel : children}
      </button>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#b42318]">{error}</p>
      ) : null}
    </div>
  );
}
