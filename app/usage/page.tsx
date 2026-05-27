import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import BillingReturnSyncClient from "@/components/BillingReturnSyncClient";
import BillingCheckoutButton from "@/components/BillingCheckoutButton";
import BillingStatusClient from "@/components/BillingStatusClient";
import UsageSummaryClient from "@/components/UsageSummaryClient";
import PlanFeatureMatrix from "@/components/PlanFeatureMatrix";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";
import { EXTRA_PACK_CATALOG, PLAN_CATALOG } from "@/lib/usage_catalog";

export const metadata: Metadata = {
  title: "利用状況",
};

type UsagePageProps = {
  searchParams: Promise<{
    checkout?: string;
    plan_change?: string;
    billing_portal?: string;
  }>;
};

export default async function UsagePage({ searchParams }: UsagePageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const shouldSyncBilling =
    resolvedSearchParams.checkout === "success" ||
    resolvedSearchParams.plan_change === "success" ||
    resolvedSearchParams.plan_change === "return" ||
    resolvedSearchParams.plan_change === "synced" ||
    resolvedSearchParams.billing_portal === "return";

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <BillingReturnSyncClient shouldSync={shouldSyncBilling} />
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
            >
              <ChevronLeft className="h-4 w-4" />
              ダッシュボード
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Usage
            </p>
            <h1 className="mt-1 text-3xl font-bold">利用状況・プラン</h1>
          </div>
          <div className="border border-[#d9ded3] bg-white px-4 py-3 text-right">
            <p className="text-sm font-bold">{currentOrganization.organization_name}</p>
            <p className="mt-1 text-xs font-semibold text-[#5f6b5f]">
              {currentOrganization.role}
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <UsageSummaryClient showExtraPacks={false} />

            <section className="border border-[#d9ded3] bg-white">
              <div className="border-b border-[#e5e9df] px-5 py-4">
                <p className="text-sm font-bold text-[#2f5d50]">Plans</p>
                <h2 className="mt-1 text-xl font-bold">プラン別の月次登録上限</h2>
              </div>
              <div className="grid gap-3 p-5 md:grid-cols-2">
                {PLAN_CATALOG.map((plan) => {
                  const isCurrent = plan.code === currentOrganization.plan_code;
                  return (
                    <article
                      key={plan.code}
                      className={
                        isCurrent
                          ? "border-2 border-[#2f5d50] bg-[#f1faf4] p-4"
                          : "border border-[#e1e6dc] bg-white p-4"
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold">{plan.name}</p>
                          <p className="mt-1 text-sm font-semibold text-[#4b5563]">
                            {plan.priceLabel}
                          </p>
                        </div>
                        {isCurrent ? (
                          <span className="rounded bg-[#2f5d50] px-2 py-1 text-xs font-bold text-white">
                            現在
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-bold">
                        {plan.includedDocuments}件
                        <span className="ml-1 text-sm font-semibold text-[#6b7280]">
                          /月
                        </span>
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[#6b7280]">
                        {plan.audience}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                        {plan.description}
                      </p>
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2 text-sm font-semibold text-[#1f2933]"
                          >
                            <CheckCircle2 className="h-4 w-4 text-[#2f5d50]" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div className="mt-4 h-10 rounded-md border border-[#cde5d5] bg-white px-3 py-2 text-center text-sm font-bold text-[#2f5d50]">
                          現在のプラン
                        </div>
                      ) : (
                        <BillingCheckoutButton
                          endpoint="/api/billing/checkout"
                          payload={{ plan_code: plan.code }}
                          className="mt-4 h-10 w-full rounded-md bg-[#2f5d50] px-3 text-sm font-bold text-white hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-70"
                          confirmMessage={`${plan.name}へプラン変更します。差額が請求または調整される場合があります。続行しますか？`}
                          loadingLabel="プランを変更中"
                        >
                          このプランに変更
                        </BillingCheckoutButton>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <PlanFeatureMatrix currentPlanCode={currentOrganization.plan_code} />
          </div>

          <aside className="space-y-6">
            <BillingStatusClient />

            <section className="border border-[#d9ded3] bg-white">
              <div className="border-b border-[#e5e9df] px-5 py-4">
                <p className="text-sm font-bold text-[#2f5d50]">Extra Packs</p>
                <h2 className="mt-1 text-xl font-bold">追加パック</h2>
              </div>
              <div className="space-y-3 p-5">
                {EXTRA_PACK_CATALOG.map((pack) => (
                  <div key={pack.code} className="border border-[#e1e6dc] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{pack.name}</p>
                        <p className="mt-1 text-sm text-[#6b7280]">
                          今月の登録枠を{pack.quantity}件追加
                        </p>
                      </div>
                      <p className="text-lg font-bold text-[#2f5d50]">
                        {pack.priceLabel}
                      </p>
                    </div>
                    <BillingCheckoutButton
                      endpoint="/api/billing/extra-pack-checkout"
                      payload={{ pack_code: pack.code }}
                      className="mt-4 h-10 w-full rounded-md bg-[#2f5d50] px-3 text-sm font-bold text-white hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-70"
                      loadingLabel="決済ページを作成中"
                    >
                      追加パックを購入
                    </BillingCheckoutButton>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-[#d9ded3] bg-white p-5">
              <p className="text-sm font-bold text-[#2f5d50]">運用メモ</p>
              <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                上限に達した場合、書類登録APIは登録前に停止します。追加パック購入または上位プラン変更後、同じ月内の登録可能件数が増えます。
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
