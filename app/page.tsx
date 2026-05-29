import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";

const features = [
  {
    label: "行政・自治体通知の要約",
    icon: FileText,
  },
  {
    label: "契約更新案内の期限抽出",
    icon: ClipboardCheck,
  },
  {
    label: "担当者付きタスク化",
    icon: Users,
  },
  {
    label: "リマインドと月次未処理一覧",
    icon: BellRing,
  },
  {
    label: "承認履歴と監査ログ",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#1f2933]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-[#d9ded3] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              YOMITORI
            </p>
            <h1 className="text-2xl font-bold">DocuTask</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/enterprise/contact"
              className="rounded-md border border-[#bbc5b4] bg-white px-4 py-2 text-sm font-semibold text-[#2f5d50] hover:bg-[#eef2eb]"
            >
              導入相談
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#24483e]"
            >
              ダッシュボード
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-4 text-sm font-semibold text-[#8a6a26]">
              管理会社向け 書類タスク化SaaS
            </p>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal md:text-5xl">
              書類を、要約・タスク・リマインド・証跡へ。
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#4b5563]">
              PDF・写真・メール本文から重要事項を抽出し、期限・提出物・担当者・注意点を整理します。
              行政通知、契約更新案内、点検報告、メール本文まで、確認が必要な書類をタスクとして扱える状態にします。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/documents/new"
                className="inline-flex items-center gap-2 rounded-md bg-[#2f5d50] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#24483e]"
              >
                書類を登録
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/unprocessed"
                className="inline-flex items-center gap-2 rounded-md border border-[#bbc5b4] bg-white px-5 py-3 text-sm font-bold text-[#2f5d50] hover:bg-[#eef2eb]"
              >
                未処理一覧
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/usage"
                className="inline-flex items-center gap-2 rounded-md border border-[#bbc5b4] bg-white px-5 py-3 text-sm font-bold text-[#2f5d50] hover:bg-[#eef2eb]"
              >
                プランを見る
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-[#2f5d50]">
              現在の主要機能
            </h3>
            <ul className="space-y-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.label}
                    className="flex items-center gap-3 rounded-md border border-[#edf0ea] px-3 py-3 text-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#edf2e8] text-[#2f5d50]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{feature.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
