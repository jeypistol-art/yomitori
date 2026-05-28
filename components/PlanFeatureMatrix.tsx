import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import {
  FEATURE_GATES,
  getFeatureAvailability,
  type FeatureKey,
} from "@/lib/feature_gates";
import { PLAN_CATALOG } from "@/lib/usage_catalog";

const themeLabels = {
  personal: "個人の効率化",
  team: "チーム運用",
  trust: "証跡と信頼",
  embedded: "業務への埋め込み",
};

const featureDestinations: Record<
  FeatureKey,
  {
    href: string;
    actionLabel: string;
  }
> = {
  personal_tasks: {
    href: "/tasks",
    actionLabel: "タスク一覧へ",
  },
  calendar_sync: {
    href: "/reminders",
    actionLabel: "リマインドへ",
  },
  team_members: {
    href: "/team",
    actionLabel: "担当者設定へ",
  },
  assignee_workflow: {
    href: "/tasks",
    actionLabel: "タスク一覧へ",
  },
  shared_ledger: {
    href: "/master-data",
    actionLabel: "台帳設定へ",
  },
  monthly_work_queue: {
    href: "/unprocessed",
    actionLabel: "未処理一覧へ",
  },
  audit_logs: {
    href: "/audit-logs",
    actionLabel: "監査ログへ",
  },
  document_diff: {
    href: "/unprocessed",
    actionLabel: "確認画面へ",
  },
  advanced_permissions: {
    href: "/team",
    actionLabel: "担当者設定へ",
  },
  branch_ledgers: {
    href: "/master-data",
    actionLabel: "台帳設定へ",
  },
  priority_processing: {
    href: "/unprocessed",
    actionLabel: "未処理一覧へ",
  },
  document_templates: {
    href: "/setup",
    actionLabel: "初期設定へ",
  },
  api_webhooks: {
    href: "/usage",
    actionLabel: "Webhook状況へ",
  },
  onboarding_support: {
    href: "/setup",
    actionLabel: "初期設定へ",
  },
  custom_rules: {
    href: "/setup",
    actionLabel: "初期設定へ",
  },
  priority_support: {
    href: "/usage",
    actionLabel: "契約状況へ",
  },
};

export default function PlanFeatureMatrix({
  currentPlanCode,
}: {
  currentPlanCode: string;
}) {
  const currentAvailability = getFeatureAvailability(currentPlanCode);

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="border-b border-[#e5e9df] px-5 py-4">
        <p className="text-sm font-bold text-[#2f5d50]">Feature Gates</p>
        <h2 className="mt-1 text-xl font-bold">プラン別の機能差分</h2>
        <p className="mt-2 text-sm leading-6 text-[#4b5563]">
          課金差分は「AIが賢い」ではなく、チームで回せる、証跡が残る、業務に埋め込めることで設計しています。
          利用可能な機能はクリックすると該当画面へ移動できます。
        </p>
      </div>
      <div className="grid gap-3 p-5 lg:grid-cols-2">
        {FEATURE_GATES.map((feature) => {
          const availability = currentAvailability.find(
            (item) => item.key === feature.key
          );
          const requiredPlan = PLAN_CATALOG.find(
            (plan) => plan.code === feature.minimumPlan
          );
          const destination = featureDestinations[feature.key];
          const isAvailable = Boolean(availability?.available);
          const cardClassName = isAvailable
            ? "block border border-[#cde5d5] bg-[#f1faf4] p-4 transition hover:border-[#2f5d50] hover:bg-[#e7f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5d50]"
            : "cursor-not-allowed border border-[#e1e6dc] bg-[#f4f5f1] p-4 text-[#6b7280] opacity-75";
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#6b7280]">
                    {themeLabels[feature.valueTheme]}
                  </p>
                  <h3 className="mt-1 break-words text-base font-bold">
                    {feature.label}
                  </h3>
                </div>
                {availability?.available ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    利用可
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#e9ece5] px-2 py-1 text-xs font-bold text-[#5f6b5f]">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    {requiredPlan?.name ?? feature.minimumPlan}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                {feature.description}
              </p>
              <div
                className={
                  isAvailable
                    ? "mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2f5d50]"
                    : "mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#6b7280]"
                }
              >
                {isAvailable ? destination.actionLabel : "プラン変更で利用可能"}
                {isAvailable ? <ArrowRight className="h-4 w-4" /> : null}
              </div>
            </>
          );

          return isAvailable ? (
            <Link
              key={feature.key}
              href={destination.href}
              className={cardClassName}
            >
              {content}
            </Link>
          ) : (
            <div
              key={feature.key}
              aria-disabled="true"
              className={cardClassName}
            >
              {content}
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#e5e9df] px-5 py-4">
        <div className="grid gap-2 md:grid-cols-4">
          {PLAN_CATALOG.map((plan) => (
            <div
              key={plan.code}
              className={
                plan.code === currentPlanCode
                  ? "border-2 border-[#2f5d50] bg-[#f1faf4] p-3"
                  : "border border-[#e1e6dc] bg-[#fbfcf8] p-3"
              }
            >
              <p className="text-sm font-bold">{plan.name}</p>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                {plan.priceLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#4b5563]">
                {plan.features.join(" / ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
