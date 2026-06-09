"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardStats = {
  documents_need_ai: number;
  documents_need_review: number;
  failed_documents: number;
  active_tasks: number;
  overdue_tasks: number;
  today_tasks: number;
  week_tasks: number;
  unassigned_tasks: number;
  due_reminders: number;
  failed_reminders: number;
};

type DashboardSummary = {
  stats: DashboardStats;
};

type ApiItem<T> = {
  data: T;
};

type TileItem = {
  title: string;
  body: string;
  href: string;
  badge?: number;
  badgeTone?: "review" | "neutral" | "urgent" | "muted";
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Request failed"
    );
  }
  return payload as T;
}

const badgeToneClasses: Record<NonNullable<TileItem["badgeTone"]>, string> = {
  review: "bg-[#fff8eb] text-[#9a5b13] ring-[#f0d6a8]",
  neutral: "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]",
  urgent: "bg-[#fff5f2] text-[#b42318] ring-[#f1c9c3]",
  muted: "bg-[#f3f4f6] text-[#4b5563] ring-[#d1d5db]",
};

function CountBadge({
  count,
  tone = "neutral",
}: {
  count?: number;
  tone?: TileItem["badgeTone"];
}) {
  if (!count || count <= 0) {
    return null;
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${
        badgeToneClasses[tone ?? "neutral"]
      }`}
    >
      {count}件
    </span>
  );
}

function TileCard({
  item,
  tone = "primary",
}: {
  item: TileItem;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link
      href={item.href}
      className={
        tone === "primary"
          ? "rounded-lg border border-[#d9ded3] bg-white p-5 transition hover:border-[#2f5d50] hover:bg-[#f1faf4]"
          : "rounded-lg border border-[#e1e6dc] bg-[#fbfcf8] p-5 text-[#4b5563] transition hover:border-[#cfd6ca] hover:bg-white"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-[#1f2933]">{item.title}</h2>
        <CountBadge count={item.badge} tone={item.badgeTone} />
      </div>
      <p className="mt-2 text-sm leading-6 text-[#4b5563]">{item.body}</p>
    </Link>
  );
}

export default function DashboardTileMenuClient({
  canManageApiWebhooks,
}: {
  canManageApiWebhooks: boolean;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let canceled = false;
    fetchJson<ApiItem<DashboardSummary>>("/api/dashboard/summary")
      .then((payload) => {
        if (!canceled) {
          setStats(payload.data.stats);
        }
      })
      .catch(() => {
        if (!canceled) {
          setStats(null);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  const unprocessedCount = stats
    ? stats.documents_need_ai +
      stats.documents_need_review +
      stats.failed_documents +
      stats.active_tasks
    : undefined;
  const reminderCount = stats
    ? stats.due_reminders + stats.failed_reminders
    : undefined;

  const dailyTiles: TileItem[] = [
    {
      title: "承認待ち",
      body: "AI抽出後、人間の確認が必要な書類",
      href: "/unprocessed",
      badge: stats?.documents_need_review,
      badgeTone: "review",
    },
    {
      title: "未処理一覧",
      body: "月次で残っている書類とタスク",
      href: "/unprocessed",
      badge: unprocessedCount,
      badgeTone: "neutral",
    },
    {
      title: "期限間近",
      body: "今週対応が必要なタスク",
      href: "/tasks?due=week",
      badge: stats?.week_tasks,
      badgeTone: "urgent",
    },
    {
      title: "リマインド",
      body: "予定されている通知",
      href: "/reminders",
      badge: reminderCount,
      badgeTone: "muted",
    },
    {
      title: "登録済み書類",
      body: "登録済み書類の一覧",
      href: "/documents/new",
    },
    {
      title: "利用状況",
      body: "月次上限・追加パック・プラン",
      href: "/usage",
    },
  ];

  const settingsTiles: TileItem[] = [
    { title: "マニュアル", body: "操作手順と画面ごとの説明", href: "/manual" },
    { title: "初期設定", body: "管理対象・担当者・通知設定の準備", href: "/setup" },
    { title: "台帳設定", body: "管理対象と取引先", href: "/master-data" },
    { title: "担当者設定", body: "担当者と権限", href: "/team" },
    { title: "監査ログ", body: "承認・削除・通知の証跡", href: "/audit-logs" },
    ...(canManageApiWebhooks
      ? [
          {
            title: "API/Webhook",
            body: "外部システム連携の仕様",
            href: "/integrations",
          },
        ]
      : []),
  ];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
          Work Menu
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {dailyTiles.map((item) => (
            <TileCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b7280]">
          Settings / Admin
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {settingsTiles.map((item) => (
            <TileCard key={item.title} item={item} tone="secondary" />
          ))}
        </div>
      </div>
    </section>
  );
}
