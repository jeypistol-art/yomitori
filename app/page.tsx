import Link from "next/link";

const features = [
  "行政・自治体通知の要約",
  "契約更新案内の期限抽出",
  "担当者付きタスク化",
  "リマインドと月次未処理一覧",
  "承認履歴と監査ログ",
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
          <Link
            href="/dashboard"
            className="rounded-md bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#24483e]"
          >
            ダッシュボード
          </Link>
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
              MVPでは行政通知と契約更新案内から開始します。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/documents/new"
                className="rounded-md bg-[#2f5d50] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#24483e]"
              >
                書類を登録
              </Link>
              <Link
                href="/monthly-open-items"
                className="rounded-md border border-[#bbc5b4] bg-white px-5 py-3 text-sm font-bold text-[#2f5d50] hover:bg-[#eef2eb]"
              >
                未処理一覧
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-[#2f5d50]">MVP対象機能</h3>
            <ul className="space-y-3">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 rounded-md border border-[#edf0ea] px-3 py-3 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-[#d19a3a]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

