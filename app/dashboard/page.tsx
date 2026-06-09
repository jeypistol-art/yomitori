import Link from "next/link";
import {
  Bell,
  BookOpen,
  CheckSquare,
  CreditCard,
  Database,
  FilePlus,
  Settings,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth_options";
import DashboardFocusClient from "@/components/DashboardFocusClient";
import DashboardTileMenuClient from "@/components/DashboardTileMenuClient";
import LogoutButton from "@/components/LogoutButton";
import PlanUpgradePanel from "@/components/PlanUpgradePanel";
import UsageSummaryClient from "@/components/UsageSummaryClient";
import { getCurrentOrganization } from "@/lib/current_organization";
import { canUseFeature } from "@/lib/feature_gates";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }
  const canUseApiWebhooks = canUseFeature(
    currentOrganization.plan_code,
    "api_webhooks"
  );
  const canManageApiWebhooks =
    canUseApiWebhooks && ["owner", "admin"].includes(currentOrganization.role);

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-6 py-8 text-[#1f2933]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Dashboard
            </p>
            <h1 className="text-3xl font-bold">YOMITORI DocuTask</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/manual"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <BookOpen className="h-4 w-4" />
              マニュアル
            </Link>
            <Link
              href="/setup"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <Settings className="h-4 w-4" />
              初期設定
            </Link>
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
              href="/usage"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <CreditCard className="h-4 w-4" />
              利用状況
            </Link>
            <Link
              href="/team"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <Users className="h-4 w-4" />
              担当者設定
            </Link>
            <Link
              href="/audit-logs"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <ShieldCheck className="h-4 w-4" />
              監査ログ
            </Link>
            <Link
              href="/master-data"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
            >
              <Database className="h-4 w-4" />
              台帳設定
            </Link>
            {canManageApiWebhooks ? (
              <Link
                href="/integrations"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6ca] bg-white px-4 text-sm font-semibold text-[#2f5d50]"
              >
                <Webhook className="h-4 w-4" />
                API/Webhook
              </Link>
            ) : null}
            <Link
              href="/documents/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white"
            >
              <FilePlus className="h-4 w-4" />
              書類を登録
            </Link>
            <LogoutButton />
          </div>
        </header>

        <div className="mb-5">
          <DashboardFocusClient />
        </div>

        <div className="mb-4">
          <UsageSummaryClient compact />
        </div>

        <div className="mb-4">
          <PlanUpgradePanel currentPlanCode={currentOrganization.plan_code} />
        </div>

        <DashboardTileMenuClient canManageApiWebhooks={canManageApiWebhooks} />
      </div>
    </main>
  );
}
