"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BillingReturnSyncClientProps = {
  shouldSync: boolean;
};

export default function BillingReturnSyncClient({
  shouldSync,
}: BillingReturnSyncClientProps) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shouldSync) {
      return;
    }

    let canceled = false;
    async function syncSubscription() {
      try {
        const response = await fetch("/api/billing/sync-subscription", {
          method: "POST",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "プラン情報を同期できませんでした"
          );
        }
        if (!canceled) {
          router.replace("/usage");
          router.refresh();
        }
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "プラン情報を同期できませんでした");
        }
      }
    }

    syncSubscription();
    return () => {
      canceled = true;
    };
  }, [router, shouldSync]);

  if (!shouldSync) {
    return null;
  }

  return (
    <div className="mb-4 border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#2f5d50]">
      {error ? error : "プラン情報を同期中です。"}
    </div>
  );
}
