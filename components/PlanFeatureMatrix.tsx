import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Handshake,
  LockKeyhole,
} from "lucide-react";
import {
  FEATURE_GATES,
  getFeatureAvailability,
  type FeatureKey,
} from "@/lib/feature_gates";
import { PLAN_CATALOG } from "@/lib/usage_catalog";
import { getEnterpriseContactPageHref } from "@/lib/enterprise_contact";

const themeLabels = {
  personal: "個人の効率化",
  team: "チーム運用",
  trust: "証跡と信頼",
  embedded: "業務への埋め込み",
};

type PlannedFeatureRoadmapItem = {
  featureKey: FeatureKey;
  phase: string;
  focus: string;
  outcome: string;
};

const plannedFeatureRoadmap: PlannedFeatureRoadmapItem[] = [
  {
    featureKey: "branch_ledgers",
    phase: "要件整理",
    focus:
      "施設、店舗、拠点ごとに台帳、書類、未処理タスクを絞り込める構成にします。",
    outcome:
      "複数拠点を持つ管理会社でも、担当範囲ごとの確認と引き継ぎがしやすくなります。",
  },
  {
    featureKey: "priority_processing",
    phase: "検証予定",
    focus:
      "至急、期限接近、高リスクの書類を未処理一覧や承認画面で上位表示します。",
    outcome:
      "処理順に迷う時間を減らし、重要書類から片付ける運用を作れます。",
  },
  {
    featureKey: "api_webhooks",
    phase: "個別要件確認",
    focus:
      "書類登録、AI抽出完了、タスク作成、リマインド送信などを外部システムへ通知します。",
    outcome:
      "既存の社内システムや管理ツールにYOMITORI DocuTaskを組み込めます。",
  },
];

const featureDestinations: Record<
  FeatureKey,
  {
    href: string;
    actionLabel: string;
    status: "ready" | "planned" | "consultation";
  }
> = {
  personal_tasks: {
    href: "/tasks",
    actionLabel: "タスク一覧へ",
    status: "ready",
  },
  calendar_sync: {
    href: "/reminders",
    actionLabel: "リマインドへ",
    status: "ready",
  },
  team_members: {
    href: "/team",
    actionLabel: "担当者設定へ",
    status: "ready",
  },
  assignee_workflow: {
    href: "/tasks",
    actionLabel: "タスク一覧へ",
    status: "ready",
  },
  shared_ledger: {
    href: "/master-data",
    actionLabel: "台帳設定へ",
    status: "ready",
  },
  monthly_work_queue: {
    href: "/unprocessed",
    actionLabel: "未処理一覧へ",
    status: "ready",
  },
  audit_logs: {
    href: "/audit-logs",
    actionLabel: "監査ログへ",
    status: "ready",
  },
  document_diff: {
    href: "/documents/new",
    actionLabel: "書類一覧へ",
    status: "ready",
  },
  advanced_permissions: {
    href: "/team",
    actionLabel: "担当者設定へ",
    status: "ready",
  },
  branch_ledgers: {
    href: "/master-data",
    actionLabel: "下のロードマップで確認",
    status: "planned",
  },
  priority_processing: {
    href: "/unprocessed",
    actionLabel: "下のロードマップで確認",
    status: "planned",
  },
  document_templates: {
    href: "/setup",
    actionLabel: "個別設計で提供",
    status: "consultation",
  },
  api_webhooks: {
    href: "/usage",
    actionLabel: "下のロードマップで確認",
    status: "planned",
  },
  onboarding_support: {
    href: "/setup",
    actionLabel: "個別支援で提供",
    status: "consultation",
  },
  custom_rules: {
    href: "/setup",
    actionLabel: "個別設計で提供",
    status: "consultation",
  },
  priority_support: {
    href: "/usage",
    actionLabel: "個別支援で提供",
    status: "consultation",
  },
};

export default function PlanFeatureMatrix({
  currentPlanCode,
}: {
  currentPlanCode: string;
}) {
  const currentAvailability = getFeatureAvailability(currentPlanCode);
  const enterpriseContactHref = getEnterpriseContactPageHref();

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="border-b border-[#e5e9df] px-5 py-4">
        <p className="text-sm font-bold text-[#2f5d50]">Feature Gates</p>
        <h2 className="mt-1 text-xl font-bold">プラン別の機能差分</h2>
        <p className="mt-2 text-sm leading-6 text-[#4b5563]">
          課金差分は「AIが賢い」ではなく、チームで回せる、証跡が残る、業務に埋め込めることで設計しています。
          利用可能な機能はクリックすると該当画面へ移動できます。個別提供の機能は導入相談へ進めます。
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
          const isPlanAvailable = Boolean(availability?.available);
          const isReady = destination.status === "ready";
          const isConsultation = destination.status === "consultation";
          const isReadyLink = isPlanAvailable && isReady;
          const isClickable = isReadyLink || isConsultation;
          const href = isConsultation ? enterpriseContactHref : destination.href;
          const cardClassName = isReadyLink
            ? "block border border-[#cde5d5] bg-[#f1faf4] p-4 transition hover:border-[#2f5d50] hover:bg-[#e7f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5d50]"
            : isConsultation
              ? "block border border-[#f0d6a8] bg-[#fff8eb] p-4 transition hover:border-[#9a5b13] hover:bg-[#fff3d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a5b13]"
              : "cursor-not-allowed border border-[#e1e6dc] bg-[#f4f5f1] p-4 text-[#6b7280] opacity-75";
          const actionLabel = isReadyLink
            ? destination.actionLabel
            : isConsultation
              ? "導入相談へ"
              : destination.status === "planned"
                ? isPlanAvailable
                  ? destination.actionLabel
                  : `${requiredPlan?.name ?? feature.minimumPlan}以上で提供予定`
              : !isPlanAvailable
                ? `${requiredPlan?.name ?? feature.minimumPlan}以上で利用可能`
                : destination.actionLabel;
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
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {isReady && isPlanAvailable ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      利用可
                    </span>
                  ) : null}
                  {destination.status === "planned" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#edf0f2] px-2 py-1 text-xs font-bold text-[#4b5563]">
                      <Clock3 className="h-3.5 w-3.5" />
                      準備中
                    </span>
                  ) : null}
                  {destination.status === "consultation" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#fff8eb] px-2 py-1 text-xs font-bold text-[#9a5b13]">
                      <Handshake className="h-3.5 w-3.5" />
                      個別提供
                    </span>
                  ) : null}
                  {!isPlanAvailable ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#e9ece5] px-2 py-1 text-xs font-bold text-[#5f6b5f]">
                      <LockKeyhole className="h-3.5 w-3.5" />
                      {requiredPlan?.name ?? feature.minimumPlan}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                {feature.description}
              </p>
              <div
                className={
                  isClickable
                    ? "mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2f5d50]"
                    : "mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#6b7280]"
                }
              >
                {actionLabel}
                {isClickable ? <ArrowRight className="h-4 w-4" /> : null}
              </div>
            </>
          );

          return isReadyLink ? (
            <Link key={feature.key} href={href} className={cardClassName}>
              {content}
            </Link>
          ) : isConsultation ? (
            <Link key={feature.key} href={href} className={cardClassName}>
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

      <div
        id="feature-roadmap"
        className="border-t border-[#e5e9df] bg-[#fbfcf8] px-5 py-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#2f5d50]">Roadmap</p>
            <h3 className="mt-1 text-lg font-bold">
              準備中機能ロードマップ
            </h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#4b5563]">
            準備中の機能はまだ操作できません。ここでは、提供予定の方向性と対象プランを確認できます。
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {plannedFeatureRoadmap.map((item) => {
            const feature = FEATURE_GATES.find(
              (gate) => gate.key === item.featureKey
            );
            if (!feature) {
              return null;
            }

            const requiredPlan = PLAN_CATALOG.find(
              (plan) => plan.code === feature.minimumPlan
            );
            const availability = currentAvailability.find(
              (entry) => entry.key === item.featureKey
            );

            return (
              <article
                key={item.featureKey}
                className="border border-[#e1e6dc] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#6b7280]">
                      {themeLabels[feature.valueTheme]}
                    </p>
                    <h4 className="mt-1 break-words text-base font-bold">
                      {feature.label}
                    </h4>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded bg-[#edf0f2] px-2 py-1 text-xs font-bold text-[#4b5563]">
                      <Clock3 className="h-3.5 w-3.5" />
                      {item.phase}
                    </span>
                    <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                      {requiredPlan?.name ?? feature.minimumPlan}以上
                    </span>
                  </div>
                </div>
                <dl className="mt-3 space-y-3 text-sm leading-6">
                  <div>
                    <dt className="font-bold text-[#1f2933]">準備していること</dt>
                    <dd className="mt-1 text-[#4b5563]">{item.focus}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#1f2933]">期待できる効果</dt>
                    <dd className="mt-1 text-[#4b5563]">{item.outcome}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs font-semibold text-[#6b7280]">
                  {availability?.available
                    ? "現在のプラン対象ですが、提供開始までは操作できません。"
                    : `${requiredPlan?.name ?? feature.minimumPlan}以上のプランで提供予定です。`}
                </p>
              </article>
            );
          })}
        </div>
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
