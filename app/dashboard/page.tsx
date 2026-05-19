import Link from "next/link";
import { Bell, CheckSquare, Database, FilePlus, Users } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth_options";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-6 py-8 text-[#1f2933]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Dashboard
            </p>
            <h1 className="text-3xl font-bold">YOMITORI DocuTask</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/unprocessed"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <CheckSquare className="h-4 w-4" />
              未処理一覧
            </Link>
            <Link
              href="/reminders"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <Bell className="h-4 w-4" />
              リマインド
            </Link>
            <Link
              href="/team"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <Users className="h-4 w-4" />
              担当者設定
            </Link>
            <Link
              href="/master-data"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <Database className="h-4 w-4" />
              台帳設定
            </Link>
            <Link
              href="/documents/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white"
            >
              <FilePlus className="h-4 w-4" />
              書類を登録
            </Link>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["台帳設定", "管理対象と取引先", "/master-data"],
            ["承認待ち", "AI抽出後、人間の確認が必要な書類", "/unprocessed"],
            ["期限間近", "今週対応が必要なタスク", "/tasks?due=week"],
            ["未処理一覧", "月次で残っている書類とタスク", "/unprocessed"],
            ["リマインド", "予定されている通知", "/reminders"],
          ].map(([title, body, href]) => (
            <Link
              key={title}
              href={href}
              className="rounded-lg border border-[#d9ded3] bg-white p-5"
            >
              <h2 className="text-base font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4b5563]">{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
