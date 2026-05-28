import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ClipboardList,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { getServerSession } from "next-auth";
import {
  getEnterpriseContactFormUrl,
  getEnterpriseContactMailtoHref,
} from "@/lib/enterprise_contact";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";

export const metadata: Metadata = {
  title: "導入相談",
};

export const dynamic = "force-dynamic";

const consultationItems = [
  "文書分類テンプレの設計",
  "拠点・管理対象ごとの台帳項目整理",
  "承認、通知、担当者割当の運用ルール設計",
  "API/Webhook連携の要件確認",
  "初期設定支援と運用開始までの段取り",
];

const formFields = [
  "会社名・屋号",
  "お名前・連絡先",
  "業種と管理対象の規模",
  "毎月扱う書類数",
  "相談したい内容",
  "導入希望時期",
];

export default async function EnterpriseContactPage() {
  const session = await getServerSession(authOptions);
  const currentOrganization = session?.user?.id
    ? await getCurrentOrganization(session.user.id)
    : null;
  const formUrl = getEnterpriseContactFormUrl({
    companyName: currentOrganization?.organization_name,
    email: session?.user?.email,
    name: session?.user?.name,
  });
  const mailtoHref = getEnterpriseContactMailtoHref();

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/usage"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
            >
              <ChevronLeft className="h-4 w-4" />
              利用状況・プラン
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Enterprise
            </p>
            <h1 className="mt-1 text-3xl font-bold">導入相談</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4b5563]">
              YOMITORI DocuTaskのEnterpriseプラン、個別提供、導入支援、API/Webhook連携に関する相談窓口です。
              書類種別や既存業務を確認し、必要な設定・運用ルール・連携範囲を整理します。
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
          >
            ダッシュボード
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="border border-[#d9ded3] bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff8eb] text-[#9a5b13]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2f5d50]">
                    相談できる内容
                  </p>
                  <h2 className="mt-1 text-xl font-bold">個別提供の設計</h2>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {consultationItems.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm font-semibold leading-6 text-[#1f2933]"
                  >
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="border border-[#d9ded3] bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf2e8] text-[#2f5d50]">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold">フォーム項目</h2>
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[#4b5563]">
                {formFields.map((field) => (
                  <li key={field}>・{field}</li>
                ))}
              </ul>
            </section>

            <section className="border border-[#f0d6a8] bg-[#fff8eb] p-5">
              <p className="text-sm font-bold text-[#9a5b13]">
                フォームが表示されない場合
              </p>
              <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                GoogleフォームのURLが未設定、またはブラウザ側で埋め込みが制限されている可能性があります。
              </p>
              <a
                href={mailtoHref}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#f0d6a8] bg-white px-3 text-sm font-bold text-[#9a5b13]"
              >
                <Mail className="h-4 w-4" />
                メールで相談する
              </a>
            </section>
          </aside>

          <section className="min-h-[720px] border border-[#d9ded3] bg-white">
            <div className="border-b border-[#e5e9df] px-5 py-4">
              <p className="text-sm font-bold text-[#2f5d50]">Contact Form</p>
              <h2 className="mt-1 text-xl font-bold">Enterprise導入相談フォーム</h2>
            </div>
            {formUrl ? (
              <iframe
                src={formUrl}
                title="YOMITORI DocuTask Enterprise導入相談フォーム"
                className="h-[760px] w-full border-0"
              />
            ) : (
              <div className="flex min-h-[640px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff8eb] text-[#9a5b13]">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-bold">GoogleフォームURLを設定してください</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#4b5563]">
                  Cloudflareの環境変数にGoogleフォームの公開URLを設定すると、このページにフォームが表示されます。
                </p>
                <div className="mt-5 max-w-xl border border-[#e1e6dc] bg-[#fbfcf8] px-4 py-3 text-left font-mono text-xs leading-6 text-[#4b5563]">
                  ENTERPRISE_CONTACT_FORM_URL=https://docs.google.com/forms/...
                </div>
                <a
                  href={mailtoHref}
                  className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-[#9a5b13] px-4 text-sm font-bold text-white"
                >
                  <Mail className="h-4 w-4" />
                  メールで相談する
                </a>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
