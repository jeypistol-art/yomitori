"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type BillingCheckoutButtonProps = {
  endpoint: "/api/billing/checkout" | "/api/billing/extra-pack-checkout";
  payload: Record<string, string>;
  children: ReactNode;
  className: string;
  disabled?: boolean;
};

type CheckoutResponse = {
  data?: {
    checkout_url?: string | null;
  };
  error?: string;
};

export default function BillingCheckoutButton({
  endpoint,
  payload,
  children,
  className,
  disabled = false,
}: BillingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
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
      if (!result.data?.checkout_url) {
        throw new Error("決済ページURLを取得できませんでした");
      }
      window.location.assign(result.data.checkout_url);
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
        {loading ? "決済ページを作成中" : children}
      </button>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#b42318]">{error}</p>
      ) : null}
    </div>
  );
}
