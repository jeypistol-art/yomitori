/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  FileText,
  GitCompareArrows,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";

const pains = [
  "行政通知、点検報告、契約更新案内が毎月積み上がる",
  "期限、提出物、担当者、注意点を人が読み取って転記している",
  "処理済みか、誰が確認したか、後から追いにくい",
];

const workflow = [
  {
    title: "書類を登録",
    body: "PDF、画像、メール本文を登録。縦横や順番が揺れても、まずは原本と本文を一元化します。",
    icon: ScanLine,
  },
  {
    title: "AIが抽出",
    body: "要約、期限、対応事項、注意点、担当者候補を整理し、承認画面で確認できます。",
    icon: FileText,
  },
  {
    title: "タスク化",
    body: "承認した内容を担当者付きタスクとリマインドに変換し、未処理一覧へ反映します。",
    icon: ClipboardCheck,
  },
  {
    title: "証跡を残す",
    body: "誰が確認し、誰へ割り当て、いつ完了したかを監査ログとして残します。",
    icon: ShieldCheck,
  },
];

const coreFeatures = [
  {
    title: "行政・自治体通知の要約",
    body: "提出期限、申請事項、注意点を読み取り、対応漏れを減らします。",
    icon: FileText,
  },
  {
    title: "契約更新案内の期限抽出",
    body: "更新期限、解約申出期限、保険満期などをタスク化します。",
    icon: ClipboardCheck,
  },
  {
    title: "担当者割当と共有台帳",
    body: "管理対象、取引先、担当者を紐付けて、チームで処理できます。",
    icon: Users,
  },
  {
    title: "リマインド通知",
    body: "期限前に担当者へ通知し、完了済みタスクの通知は自動で止めます。",
    icon: BellRing,
  },
  {
    title: "監査ログ",
    body: "確認、承認、割当、課金状態の変化を履歴として確認できます。",
    icon: ShieldCheck,
  },
  {
    title: "差分・優先処理へ拡張",
    body: "過去書類との差分確認と、期限や注意点にもとづく優先処理に対応します。",
    icon: GitCompareArrows,
  },
];

const planHighlights = [
  {
    name: "Personal",
    price: "2,980円/月",
    body: "個人で要約、期限抽出、タスク化を始める基本プラン。",
  },
  {
    name: "Business",
    price: "9,800円/月",
    body: "複数ユーザー、担当者割当、共有台帳を使う標準プラン。",
  },
  {
    name: "Pro",
    price: "19,800円/月",
    body: "権限管理、監査ログ、差分確認、優先処理を見据えた運用プラン。",
  },
  {
    name: "Enterprise",
    price: "49,800円/月〜",
    body: "分類テンプレ、運用ルール設計、API/Webhook、初期支援込み。",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[#f7f8f5] text-[#1f2933]">
      <section className="relative min-h-[76svh] overflow-hidden bg-[#183d35] text-white">
        <img
          src="/images/landing-hero-docutask.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102c27]/95 via-[#102c27]/76 to-[#102c27]/22" />

        <div className="relative mx-auto flex min-h-[76svh] max-w-7xl flex-col px-5 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4 border-b border-white/18 pb-5">
            <Link href="/" className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7b56d]">
                YOMITORI
              </p>
              <p className="text-xl font-bold">DocuTask</p>
            </Link>
            <nav
              aria-label="トップページ"
              className="flex shrink-0 flex-wrap justify-end gap-2"
            >
              <Link
                href="/enterprise/contact"
                className="rounded-md border border-white/35 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur hover:bg-white/18"
              >
                導入相談
              </Link>
              <Link
                href="/login"
                className="rounded-md bg-white px-4 py-2 text-sm font-bold text-[#1f2933] hover:bg-[#edf2e8]"
              >
                ログイン
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-12">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-[#d7b56d]">
                不動産・施設管理会社向け 書類タスク化SaaS
              </p>
              <h1 className="mt-4 text-5xl font-bold leading-tight tracking-normal md:text-6xl">
                YOMITORI DocuTask
              </h1>
              <p className="mt-5 max-w-2xl text-2xl font-bold leading-snug text-white">
                書類を、要約・タスク・リマインド・証跡へ。
              </p>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#e7eee9]">
                行政通知、契約更新案内、点検報告、メール本文から重要事項を抽出し、
                期限・提出物・担当者・注意点を確認できるタスクへ変換します。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-md bg-[#d7b56d] px-5 py-3 text-sm font-bold text-[#1f2933] hover:bg-[#e3c987]"
                >
                  ログインして使う
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/enterprise/contact"
                  className="inline-flex items-center gap-2 rounded-md border border-white/35 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/18"
                >
                  導入相談
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9ded3] bg-white px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {pains.map((pain) => (
            <div key={pain} className="border-l-4 border-[#d7b56d] pl-4">
              <p className="text-sm font-bold leading-6 text-[#1f2933]">
                {pain}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-[#2f5d50]">Workflow</p>
            <h2 className="mt-2 text-3xl font-bold">
              読む作業を、確認して進める作業へ。
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#4b5563]">
              YOMITORI DocuTaskは、AI抽出結果をそのまま確定させるのではなく、
              人が見比べて承認し、組織で引き継げる形に整えます。
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="border border-[#d9ded3] bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#edf2e8] text-[#2f5d50]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold text-[#d7b56d]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-[#2f5d50]">Features</p>
              <h2 className="mt-2 text-3xl font-bold">
                管理会社の書類運用に必要な機能を、順番に。
              </h2>
            </div>
            <Link
              href="/usage"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] px-4 text-sm font-bold text-[#2f5d50] hover:bg-[#eef2eb]"
            >
              プランを見る
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {coreFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="border border-[#e1e6dc] bg-[#fbfcf8] p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#2f5d50]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-[#2f5d50]">Plans</p>
            <h2 className="mt-2 text-3xl font-bold">
              高額プランは、会社で回せるから高い。
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#4b5563]">
              価格差はAIの賢さではなく、複数人で運用できること、権限と証跡が残ること、
              既存業務に組み込めることに置いています。
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {planHighlights.map((plan) => (
              <article
                key={plan.name}
                className="border border-[#d9ded3] bg-white p-5"
              >
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-2 text-xl font-bold text-[#2f5d50]">
                  {plan.price}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                  {plan.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1f3f37] px-5 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold">
              まずは、今ある書類の読み取り時間を減らすところから。
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#e7eee9]">
              管理会社の実務に合わせた分類、通知、台帳設計は導入相談で整理できます。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-[#d7b56d] px-5 py-3 text-sm font-bold text-[#1f2933] hover:bg-[#e3c987]"
            >
              ログイン
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/enterprise/contact"
              className="inline-flex items-center gap-2 rounded-md border border-white/35 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              導入相談
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
