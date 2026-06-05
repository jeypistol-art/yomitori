import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ChevronLeft,
  ClipboardCheck,
  Code2,
  FileText,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ApiKeySettingsClient from "@/components/ApiKeySettingsClient";
import FeatureGateNotice from "@/components/FeatureGateNotice";
import HeaderAccountActions from "@/components/HeaderAccountActions";
import WebhookSettingsClient from "@/components/WebhookSettingsClient";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";
import { getEnterpriseContactPageHref } from "@/lib/enterprise_contact";
import { canUseFeature } from "@/lib/feature_gates";

export const metadata: Metadata = {
  title: "API/Webhook",
};

const webhookEvents = [
  {
    event: "document.created",
    title: "書類登録",
    body: "PDF、画像、メール本文が登録された時点で通知します。",
    icon: FileText,
  },
  {
    event: "document.extraction_succeeded",
    title: "AI抽出完了",
    body: "要約、期限、タスク候補の抽出が成功した時点で通知します。",
    icon: Webhook,
  },
  {
    event: "document.approved",
    title: "承認完了",
    body: "人間の確認を経て、抽出結果が確定した時点で通知します。",
    icon: ShieldCheck,
  },
  {
    event: "task.created",
    title: "タスク作成",
    body: "承認結果からタスクが作成された時点で通知します。",
    icon: ClipboardCheck,
  },
  {
    event: "reminder.sent",
    title: "リマインド送信",
    body: "担当者へメール通知が送信された時点で通知します。",
    icon: BellRing,
  },
  {
    event: "webhook.test",
    title: "テスト送信",
    body: "送信先一覧のテスト送信ボタンからのみ送信します。実イベント購読には使いません。",
    icon: Code2,
  },
];

const payloadExample = `{
  "id": "evt_ydt_01H...",
  "type": "document.approved",
  "created_at": "2026-06-01T09:00:00.000Z",
  "organization_id": "org_...",
  "data": {
    "document": {
      "id": "doc_...",
      "title": "防火対象物定期点検報告書の提出について",
      "document_type": "municipal_notice",
      "status": "approved",
      "due_date": "2026-06-30"
    },
    "tasks": [
      {
        "id": "task_...",
        "title": "報告書を提出する",
        "due_date": "2026-06-30",
        "priority": "high"
      }
    ]
  }
}`;

const headerExample = `Content-Type: application/json
User-Agent: YOMITORI-DocuTask-Webhooks/1.0
YDT-Event-Id: evt_ydt_...
YDT-Event-Type: document.approved
YDT-Timestamp: 2026-06-01T09:00:00.000Z
YDT-Signature: v1=<hex encoded hmac sha256>`;

const apiAuthHeaderExample = `Authorization: Bearer ydt_live_...
Accept: application/json`;

const documentsEndpointExample = `GET /api/external/documents?limit=50
Authorization: Bearer ydt_live_...

Query:
limit=1..100
status=uploaded|processing|extracted|approved|completed|failed
before=2026-06-01T09:00:00.000Z
updated_since=2026-06-01T00:00:00.000Z

Required scope:
documents:read`;

const tasksEndpointExample = `GET /api/external/tasks?limit=50
Authorization: Bearer ydt_live_...

Query:
limit=1..100
status=todo|in_progress|waiting|done|unnecessary|canceled
assignee=<member_id>|unassigned
due=overdue|week|none
document_id=<document_id>
before=2026-06-01T09:00:00.000Z
updated_since=2026-06-01T00:00:00.000Z

Required scope:
tasks:read`;

const webhookDeliveriesEndpointExample = `GET /api/external/webhook-deliveries?limit=50
Authorization: Bearer ydt_live_...

Query:
limit=1..100
endpoint_id=<webhook_endpoint_id>
status=queued|succeeded|failed|dead
event_type=document.created|document.approved|task.created|reminder.sent|webhook.test
before=2026-06-01T09:00:00.000Z
updated_since=2026-06-01T00:00:00.000Z

Required scope:
webhooks:read`;

const signatureExample = `署名対象文字列:
<YDT-Timestamp>.<raw request body>

署名方式:
HMAC-SHA256(secret, signed_payload)

比較値:
YDT-Signature === "v1=" + hex_digest`;

const nodeVerificationExample = `import crypto from "node:crypto";

export function verifyYomitoriWebhook({
  rawBody,
  timestamp,
  signatureHeader,
  secret,
}: {
  rawBody: string;
  timestamp: string;
  signatureHeader: string;
  secret: string;
}) {
  const expected =
    "v1=" +
    crypto
      .createHmac("sha256", secret)
      .update(\`\${timestamp}.\${rawBody}\`)
      .digest("hex");

  const actual = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);
  return (
    actual.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actual, expectedBuffer)
  );
}`;

export default async function IntegrationsPage() {
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
  const enterpriseContactHref = getEnterpriseContactPageHref();

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
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
              Integrations
            </p>
            <h1 className="mt-1 text-3xl font-bold">API/Webhook</h1>
          </div>
          <HeaderAccountActions
            organizationName={currentOrganization.organization_name}
            role={currentOrganization.role}
          />
        </header>

        <div className="space-y-5">
          <FeatureGateNotice
            currentPlanCode={currentOrganization.plan_code}
            featureKey="api_webhooks"
          />

          {canUseApiWebhooks ? (
            <>
              <ApiKeySettingsClient />

              <WebhookSettingsClient />

              <section className="border border-[#d9ded3] bg-white">
                <div className="border-b border-[#e5e9df] px-5 py-4">
                  <p className="text-sm font-bold text-[#2f5d50]">
                    Webhook Events
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    外部システムへ通知するイベント
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    YOMITORI DocuTask上で発生した業務イベントを、管理会社側の既存システム、チャット、台帳、BIツールへ渡すための連携仕様です。
                  </p>
                </div>
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {webhookEvents.map((item) => {
                    const Icon = item.icon;
                    return (
                      <article
                        key={item.event}
                        className="border border-[#e1e6dc] bg-[#fbfcf8] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#edf2e8] text-[#2f5d50]">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold text-[#2f5d50]">
                              {item.event}
                            </p>
                            <h3 className="mt-1 break-words text-base font-bold">
                              {item.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                              {item.body}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="border border-[#d9ded3] bg-white">
                <div className="border-b border-[#e5e9df] px-5 py-4">
                  <p className="text-sm font-bold text-[#2f5d50]">
                    API Authentication
                  </p>
                  <h2 className="mt-1 text-xl font-bold">APIキー認証</h2>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    外部APIはBearerトークンで認証する設計です。APIキーは作成直後のみ全文表示され、以後はハッシュ化された値だけを保持します。
                  </p>
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  <section>
                    <h3 className="text-base font-bold">認証ヘッダー</h3>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {apiAuthHeaderExample}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">運用ルール</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5563]">
                      <li>連携先ごとにAPIキーを分けて発行します。</li>
                      <li>不要になったキーは削除ではなく失効として記録します。</li>
                      <li>キー本文は再表示できないため、紛失時は新規発行します。</li>
                      <li>利用範囲はスコープで分け、必要最小限にします。</li>
                    </ul>
                  </section>
                </div>
              </section>

              <section className="border border-[#d9ded3] bg-white">
                <div className="border-b border-[#e5e9df] px-5 py-4">
                  <p className="text-sm font-bold text-[#2f5d50]">
                    External API
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    外部向け読み取りAPI
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    まずは書類メタデータの参照APIを提供します。原本文やファイルURLは返さず、台帳・BI・管理システム連携で使う項目に限定します。
                  </p>
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  <section>
                    <h3 className="text-base font-bold">
                      書類一覧
                    </h3>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {documentsEndpointExample}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">返却する主な項目</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5563]">
                      <li>書類ID、タイトル、要約、書類種別、状態</li>
                      <li>書類日付、期限、承認日時、完了日時</li>
                      <li>取引先名、管理対象、ファイル数、タスク数</li>
                      <li>最新AI抽出ステータス、作成日時、更新日時</li>
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">
                      タスク一覧
                    </h3>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {tasksEndpointExample}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">
                      タスクAPIの返却項目
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5563]">
                      <li>タスクID、タイトル、説明、期限、優先度、状態</li>
                      <li>関連書類ID、書類タイトル、書類状態</li>
                      <li>担当者ID、担当者名、担当者メールアドレス</li>
                      <li>予定リマインド数、次回リマインド日時、作成日時、更新日時</li>
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">
                      Webhook配信履歴
                    </h3>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {webhookDeliveriesEndpointExample}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">
                      Webhook履歴APIの返却項目
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5563]">
                      <li>配信ID、送信先ID、送信先名、イベントID、イベント種別</li>
                      <li>配信状態、試行回数、最大試行回数、次回試行日時</li>
                      <li>最終試行日時、配信成功日時、HTTPステータス、失敗理由</li>
                      <li>作成日時、更新日時</li>
                    </ul>
                  </section>
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <section className="border border-[#d9ded3] bg-white">
                  <div className="border-b border-[#e5e9df] px-5 py-4">
                    <p className="text-sm font-bold text-[#2f5d50]">
                      Payload
                    </p>
                    <h2 className="mt-1 text-xl font-bold">送信ペイロード例</h2>
                  </div>
                  <div className="p-5">
                    <pre className="overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {payloadExample}
                    </pre>
                  </div>
                </section>

                <aside className="space-y-5">
                  <section className="border border-[#d9ded3] bg-white p-5">
                    <div className="flex items-start gap-3">
                      <KeyRound className="mt-0.5 h-5 w-5 text-[#2f5d50]" />
                      <div>
                        <h2 className="text-base font-bold">署名検証</h2>
                        <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                          `YDT-Signature`ヘッダーでHMAC-SHA256署名を付与する設計です。受信側は共有シークレットで本文改ざんを検証できます。
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="border border-[#d9ded3] bg-white p-5">
                    <div className="flex items-start gap-3">
                      <RotateCcw className="mt-0.5 h-5 w-5 text-[#2f5d50]" />
                      <div>
                        <h2 className="text-base font-bold">再送設計</h2>
                        <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                          2xx以外の応答は失敗として記録し、初期導入時に決めた回数と間隔で再送します。失敗履歴は監査ログと合わせて確認できる構成にします。
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="border border-[#f0d6a8] bg-[#fff8eb] p-5">
                    <p className="text-sm font-bold text-[#9a5b13]">
                      導入時に決めること
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5563]">
                      <li>送信先URL</li>
                      <li>通知するイベント種別</li>
                      <li>共有シークレットと署名検証方法</li>
                      <li>再送回数、再送間隔、失敗時の連絡先</li>
                    </ul>
                    <Link
                      href={enterpriseContactHref}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#9a5b13] px-3 text-sm font-bold text-white"
                    >
                      連携要件を相談する
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </section>
                </aside>
              </div>

              <section className="border border-[#d9ded3] bg-white">
                <div className="border-b border-[#e5e9df] px-5 py-4">
                  <p className="text-sm font-bold text-[#2f5d50]">
                    Receiver Implementation
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    受信側実装の要点
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    受信側は2xxを返すと成功扱いになります。本文をJSONとして処理する前に、raw bodyと共有シークレットで署名検証してください。
                  </p>
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  <section>
                    <h3 className="text-base font-bold">送信ヘッダー</h3>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {headerExample}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-base font-bold">署名計算式</h3>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {signatureExample}
                    </pre>
                  </section>
                  <section className="lg:col-span-2">
                    <h3 className="text-base font-bold">Node.js検証例</h3>
                    <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                      `rawBody`はJSON.parse前の文字列を渡してください。整形後のJSONで検証すると署名が一致しません。
                    </p>
                    <pre className="mt-3 overflow-x-auto border border-[#e1e6dc] bg-[#101814] p-4 text-xs leading-6 text-[#e7eee9]">
                      {nodeVerificationExample}
                    </pre>
                  </section>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
