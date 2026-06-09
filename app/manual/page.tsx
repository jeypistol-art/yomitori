import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Lightbulb,
} from "lucide-react";

export const metadata: Metadata = {
  title: "簡易操作マニュアル",
  description:
    "YOMITORI DocuTaskのログイン、書類登録、AI抽出確認、タスク、リマインド、管理者設定の簡易操作マニュアルです。",
};

type Role = "all" | "staff" | "admin";

type NavItem = {
  id: string;
  title: string;
  role: Role;
};

const navItems: NavItem[] = [
  { id: "flow", title: "基本の流れ", role: "all" },
  { id: "login", title: "ログイン", role: "all" },
  { id: "dashboard", title: "ダッシュボード", role: "all" },
  { id: "setup", title: "初期設定", role: "admin" },
  { id: "master-data", title: "台帳設定", role: "admin" },
  { id: "team", title: "担当者管理", role: "admin" },
  { id: "documents-new", title: "書類を登録", role: "staff" },
  { id: "review", title: "AI抽出確認・承認", role: "staff" },
  { id: "unprocessed", title: "未処理一覧", role: "staff" },
  { id: "tasks", title: "タスク一覧", role: "staff" },
  { id: "reminders", title: "リマインド", role: "staff" },
  { id: "audit-logs", title: "監査ログ", role: "admin" },
  { id: "usage", title: "利用状況・プラン", role: "admin" },
  { id: "integrations", title: "API/Webhook", role: "admin" },
  { id: "common-actions", title: "よくある操作", role: "all" },
  { id: "notes", title: "注意事項", role: "all" },
  { id: "support", title: "問い合わせ時の情報", role: "all" },
];

const roleLabels: Record<Role, string> = {
  all: "全員",
  staff: "担当者",
  admin: "管理者",
};

const roleClassNames: Record<Role, string> = {
  all: "bg-[#f3f4f6] text-[#4b5563] ring-[#d1d5db]",
  staff: "bg-[#edf7ef] text-[#24613f] ring-[#cde5d5]",
  admin: "bg-[#fff8eb] text-[#9a5b13] ring-[#f0d6a8]",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-bold ring-1 ${roleClassNames[role]}`}
    >
      {roleLabels[role]}
    </span>
  );
}

function ManualSection({
  children,
  id,
  role,
  title,
}: {
  children: React.ReactNode;
  id: string;
  role: Role;
  title: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 border border-[#d9ded3] bg-white px-5 py-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <RoleBadge role={role} />
        <h2 className="text-2xl font-bold tracking-normal">{title}</h2>
      </div>
      <div className="mt-5 space-y-5 text-sm leading-7 text-[#374151]">
        {children}
      </div>
    </section>
  );
}

function ManualTable({
  rows,
}: {
  rows: Array<[string, React.ReactNode]>;
}) {
  return (
    <div className="overflow-hidden border border-[#e1e6dc]">
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {rows.map(([label, body]) => (
            <tr key={label} className="border-b border-[#edf0e8] last:border-b-0">
              <th className="w-36 bg-[#fbfcf8] px-3 py-3 align-top font-bold text-[#2f5d50]">
                {label}
              </th>
              <td className="px-3 py-3 text-[#374151]">{body}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberedSteps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#edf2e8] text-xs font-bold text-[#2f5d50]">
            {index + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function ImportantBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[#f1d3a8] bg-[#fff8eb] px-4 py-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9a5b13]" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-[#7c4a10]">重要</p>
          <div className="text-sm leading-7 text-[#6b4a1f]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#cde5d5] bg-[#f1faf4] px-4 py-4">
      <div className="flex gap-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[#2f5d50]" />
        <div className="space-y-2">
          <p className="text-sm font-bold text-[#24613f]">{title}</p>
          <div className="text-sm leading-7 text-[#2f5d50]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function InlineScreen({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-[#1f2933]">【{children}】</span>;
}

function InlineAction({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-[#1f2933]">{children}</strong>;
}

export default function ManualPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-[#d9ded3] pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
              >
                <ChevronLeft className="h-4 w-4" />
                ダッシュボード
              </Link>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
                Manual
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-normal">
                YOMITORI DocuTask 簡易操作マニュアル
              </h1>
              <p className="mt-2 text-xs font-semibold text-[#6b7280]">
                最終更新: 2026-06-09
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4b5563]">
                書類登録、AI抽出確認、タスク、リマインド、管理者設定までを
                画面ごとに確認できます。役割バッジを目印に、必要な箇所から読んでください。
              </p>
            </div>
            <Link
              href="/documents/new"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white"
            >
              書類を登録
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <RoleBadge role="all" />
            <RoleBadge role="staff" />
            <RoleBadge role="admin" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <nav
              aria-label="マニュアル目次"
              className="border border-[#d9ded3] bg-white p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#2f5d50]" />
                <p className="text-sm font-bold">目次</p>
              </div>
              <div className="space-y-1">
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-2 text-xs font-semibold text-[#4b5563] hover:bg-[#f1faf4] hover:text-[#2f5d50]"
                  >
                    <span>{item.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${roleClassNames[item.role]}`}
                    >
                      {roleLabels[item.role]}
                    </span>
                  </a>
                ))}
              </div>
            </nav>
          </aside>

          <div className="space-y-5">
            <ManualSection id="flow" role="all" title="1. 基本の流れ">
              <NumberedSteps
                items={[
                  <>
                    <InlineScreen>書類を登録</InlineScreen>で書類を登録する
                  </>,
                  <>
                    <InlineScreen>AI抽出確認・承認</InlineScreen>でAI抽出結果を確認する
                  </>,
                  "必要に応じて内容を修正する",
                  <>
                    <InlineAction>承認してタスク作成</InlineAction>を押す
                  </>,
                  <>
                    <InlineScreen>タスク一覧</InlineScreen>と
                    <InlineScreen>リマインド</InlineScreen>で対応を進める
                  </>,
                  <>
                    必要に応じて<InlineScreen>監査ログ</InlineScreen>で操作履歴を確認する
                  </>,
                ]}
              />
              <ImportantBox>
                AIの抽出結果は最終確定情報ではありません。必ず人間の目で原本と照合してから承認してください。
              </ImportantBox>
            </ManualSection>

            <ManualSection id="login" role="all" title="2. ログイン">
              <p>
                <InlineScreen>ログイン</InlineScreen>
                画面から、Googleアカウントまたはメール認証でログインします。
              </p>
              <ManualTable
                rows={[
                  ["Googleアカウント", <><InlineAction>Googleでログイン</InlineAction>を押します。</>],
                  ["メール認証", "メールアドレスを入力し、届いたログインリンクからアクセスします。"],
                ]}
              />
              <p>
                メール認証のログインリンクには有効期限があります。期限切れになった場合は、もう一度メールアドレスを入力してください。
              </p>
            </ManualSection>

            <ManualSection id="dashboard" role="all" title="3. ダッシュボード">
              <p>
                <InlineScreen>ダッシュボード</InlineScreen>
                は、ログイン後に最初に見る画面です。現在の状況や、次に自分が起こすべきアクションがひと目で分かります。
              </p>
              <ManualTable
                rows={[
                  ["クイックナビ", "失敗書類、承認待ち、期限切れなどのアラートが表示されます。最初に確認すると迷いにくくなります。"],
                  ["次に対応すべき項目", "承認待ち、未処理一覧、期限間近、リマインド"],
                  ["状況把握", "最近の書類、今月の利用状況"],
                  ["メニュー", "書類登録、台帳設定、タスク一覧、監査ログ、利用状況など"],
                ]}
              />
            </ManualSection>

            <ManualSection id="setup" role="admin" title="4. 初期設定">
              <p>
                <InlineScreen>初期設定</InlineScreen>
                は、運用開始前に必要なマスタ登録や、システムの稼働状況を確認する画面です。一般の担当者は通常、設定を変更する必要はありません。
              </p>
              <ManualTable
                rows={[
                  ["マスタ登録", "管理対象の登録、取引先の登録、担当者の登録"],
                  ["通知・運用", "リマインド設定、未処理件数、失敗中ジョブ件数"],
                  ["接続状態", "データベース(Neon)、ストレージ(R2)、AI(OpenAI)、メール送信、決済(Stripe)、定期実行(Cron)、Webhookなど"],
                ]}
              />
              <TipBox title="トラブルシューティング">
                画面に異常が発生した場合は、【初期設定】にある「運用チェック項目」を確認してください。問い合わせ時にその内容を伝えると、原因の切り分けがスムーズです。
              </TipBox>
            </ManualSection>

            <ManualSection id="master-data" role="admin" title="5. 台帳設定">
              <p>
                <InlineScreen>台帳設定</InlineScreen>
                では、書類に紐づける
                <InlineScreen>管理対象</InlineScreen>と
                <InlineScreen>取引先</InlineScreen>を登録します。
              </p>
              <h3 className="text-lg font-bold text-[#1f2933]">管理対象</h3>
              <ManualTable
                rows={[
                  ["種別", "物件、施設、店舗、テナント、事務所、その他など"],
                  ["名称", "管理対象の名前"],
                  ["コード", "任意。社内の物件番号、施設ID、店舗コードなど"],
                  ["住所", "所在地"],
                  ["メモ", "補足情報"],
                  ["上位管理対象", "Proプラン以上で利用する拠点・階層管理"],
                ]}
              />
              <h3 className="text-lg font-bold text-[#1f2933]">管理対象の種別追加</h3>
              <p>
                標準の種別に当てはまらない場合は、種別のプルダウンから
                <InlineAction>＋種別を追加</InlineAction>を選びます。
              </p>
              <p>
                不要になった追加種別は、追加済み種別の削除ボタンから削除できます。削除した場合、その種別を使っていた登録済みデータは自動的に【その他】へと変更されます。データ自体は削除されません。
              </p>
              <h3 className="text-lg font-bold text-[#1f2933]">取引先</h3>
              <ManualTable
                rows={[
                  ["種別", "行政・自治体、業者、保険会社、リース会社、その他など"],
                  ["名称", "取引先名"],
                  ["担当者", "取引先側の担当者名"],
                  ["メール", "連絡先メールアドレス"],
                  ["電話", "連絡先電話番号"],
                  ["住所", "所在地"],
                  ["メモ", "補足情報"],
                ]}
              />
              <p>
                取引先の追加種別も同じく、削除した場合は該当データが自動的に【その他】へと変更されます。データ自体は削除されません。
              </p>
            </ManualSection>

            <ManualSection id="team" role="admin" title="6. 担当者管理">
              <p>
                チーム運用では、担当者を登録しておくことで、
                <InlineScreen>AI抽出確認・承認</InlineScreen>や
                <InlineScreen>タスク一覧</InlineScreen>で担当者を割り当てられます。
              </p>
              <ManualTable
                rows={[
                  ["タスク割当", "誰が対応するかを明確にできます"],
                  ["リマインド通知", "担当者へ期限前の通知を送れます"],
                  ["未割当確認", "担当者が決まっていないタスクを見つけやすくなります"],
                  ["証跡管理", "誰が確認し、誰に割り当てたかを残せます"],
                ]}
              />
            </ManualSection>

            <ManualSection id="documents-new" role="staff" title="7. 書類を登録">
              <p>
                <InlineScreen>書類を登録</InlineScreen>
                では、PDF、画像、メール本文などを登録できます。
              </p>
              <ManualTable
                rows={[
                  ["PDFアップロード", "点検報告書、契約書、通知書など"],
                  ["画像アップロード", "スキャン画像、スマートフォンで撮影した書類など"],
                  ["メール本文貼り付け", "自治体からのメール、業者からの更新案内、社内チャットの依頼文など"],
                ]}
              />
              <ManualTable
                rows={[
                  ["タイトル", "書類名。空欄の場合、ファイル名や本文先頭から候補が入ることがあります。"],
                  ["取引先", "書類の発行元や関係先"],
                  ["管理対象", "対象となる物件、施設、店舗、テナントなど"],
                  ["メール本文・通知文", "テキストで届いた内容を貼り付けます"],
                  ["PDF・画像ファイル", "原本ファイルを登録します"],
                ]}
              />
              <TipBox title="知っておくと便利な機能: 一時保存">
                書類登録の途中で、管理対象や取引先が未登録であることに気づいた場合、登録画面を閉じずにそのまま【台帳設定】へ移動できます。
                入力途中の「タイトル」「取引先」「管理対象」「本文」は自動で一時保存され、台帳登録を終えて戻ると前の状態から再開できます。
              </TipBox>
            </ManualSection>

            <ManualSection id="review" role="staff" title="8. AI抽出確認・承認">
              <p>
                <InlineScreen>AI抽出確認・承認</InlineScreen>
                は、AIが解析した結果を人間がチェックし、正式なタスクとして確定させる最重要の画面です。画面の左側に原本、右側にAIの抽出結果が表示されます。
              </p>
              <ManualTable
                rows={[
                  ["基本情報", "書類タイトル、書類種別、要約、重要事項、管理対象"],
                  ["アラート・変化", "期限、提出物、注意点、過去書類との差分"],
                  ["アクション", "タスク候補、タスク名、説明、期限、優先度、担当者、リマインド日"],
                ]}
              />
              <ImportantBox>
                AIの抽出結果は最終確定情報ではありません。必ず人間の目で原本と照合し、内容に誤りがある場合はこの画面で修正してから
                <InlineAction>承認してタスク作成</InlineAction>を押してください。
              </ImportantBox>
              <h3 className="text-lg font-bold text-[#1f2933]">書類種別の追加</h3>
              <p>
                標準の書類種別に当てはまらない場合は、書類種別のプルダウンから
                <InlineAction>＋種別を追加</InlineAction>を選びます。
                不要になった追加書類種別は削除できます。削除した場合、その書類種別を使っていた登録済み書類は自動的に【その他】へと変更されます。書類データ自体は削除されません。
              </p>
              <h3 className="text-lg font-bold text-[#1f2933]">管理対象の紐づけ</h3>
              <p>
                管理対象が未設定の場合、後から書類を探しにくくなる可能性があります。
                承認前に、対象となる物件、施設、店舗、テナントなどを選択してください。
              </p>
              <h3 className="text-lg font-bold text-[#1f2933]">タスク候補</h3>
              <ManualTable
                rows={[
                  ["タスク名", "対応すべき内容"],
                  ["説明", "補足説明"],
                  ["期限", "対応期限"],
                  ["優先度", "低、通常、高、至急"],
                  ["担当者", "対応する人"],
                  ["リマインド日", "期限の何日前に通知するか"],
                  ["承認時に作成", "承認時にタスクとして作るかどうか"],
                ]}
              />
              <p>
                内容を確認したら <InlineAction>承認してタスク作成</InlineAction>
                を押します。承認すると、書類の状態が承認済みになり、作成対象のタスクが【タスク一覧】に追加されます。
              </p>
            </ManualSection>

            <ManualSection id="unprocessed" role="staff" title="9. 未処理一覧">
              <p>
                <InlineScreen>未処理一覧</InlineScreen>
                では、まだ処理が必要な書類やタスクをまとめて確認できます。
              </p>
              <ManualTable
                rows={[
                  ["AI未抽出", "登録後、まだAI抽出が終わっていない書類"],
                  ["承認待ち", "人による確認・承認が必要な書類"],
                  ["抽出失敗", "AI抽出や登録処理に失敗した書類"],
                  ["未完了タスク", "まだ完了していないタスク"],
                  ["期限超過", "期限を過ぎたタスク"],
                  ["担当未設定", "担当者が割り当てられていないタスク"],
                ]}
              />
              <p>
                優先処理が有効な場合は、期限切れ、期限接近、注意点ありなどをもとに、重要度順に表示されます。
              </p>
            </ManualSection>

            <ManualSection id="tasks" role="staff" title="10. タスク一覧">
              <p>
                <InlineScreen>タスク一覧</InlineScreen>
                では、承認時に作成された対応タスクを確認・更新できます。
              </p>
              <ManualTable
                rows={[
                  ["ステータス変更", "未着手、対応中、完了などに変更します"],
                  ["担当者変更", "対応する人を変更します"],
                  ["期限変更", "対応期限を変更します"],
                  ["優先度変更", "低、通常、高、至急を変更します"],
                  ["タスク削除", "不要なタスクを削除します"],
                ]}
              />
              <p>
                期限切れ、本日期限、今週対応、担当者未設定などの条件で確認できます。
              </p>
            </ManualSection>

            <ManualSection id="reminders" role="staff" title="11. リマインド">
              <p>
                <InlineScreen>リマインド</InlineScreen>
                では、タスクに紐づいた通知予定や送信結果を確認できます。
              </p>
              <ManualTable
                rows={[
                  ["全て", "すべてのリマインド"],
                  ["期限切れ", "予定時刻を過ぎたリマインド"],
                  ["本日", "今日送信予定のリマインド"],
                  ["予定リマインド", "今後送信予定の通知"],
                  ["送信失敗", "メール送信に失敗した通知"],
                ]}
              />
              <p>
                タスクが完了済みになった場合、そのタスクに対する未送信リマインドは送信対象から外れます。
              </p>
            </ManualSection>

            <ManualSection id="audit-logs" role="admin" title="12. 監査ログ">
              <p>
                <InlineScreen>監査ログ</InlineScreen>
                では、主な操作履歴を確認できます。一般の担当者が日常的に確認する画面ではありません。
              </p>
              <ManualTable
                rows={[
                  ["書類承認", "誰がいつ承認したか"],
                  ["タスク作成", "承認時に何件タスクを作成したか"],
                  ["リマインド送信", "いつ通知を送ったか"],
                  ["リマインド再送", "誰が再送したか"],
                  ["課金・プラン関連", "プラン変更、追加パック購入など"],
                  ["API/Webhook関連", "外部連携の送信履歴など"],
                ]}
              />
            </ManualSection>

            <ManualSection id="usage" role="admin" title="13. 利用状況・プラン">
              <p>
                <InlineScreen>利用状況・プラン</InlineScreen>
                では、現在のプラン、今月の利用状況、追加パック、プラン別の機能差分を確認できます。
              </p>
              <ManualTable
                rows={[
                  ["現在のプラン", "Personal、Business、Pro、Enterpriseなど"],
                  ["今月の書類登録数", "当月に登録した書類数"],
                  ["残り登録可能数", "今月あと何件登録できるか"],
                  ["追加パック", "上限を超える場合の追加購入"],
                  ["プラン変更", "上位プランへの変更"],
                  ["解約予定", "解約予定の有無"],
                  ["機能差分", "プランごとに使える機能"],
                ]}
              />
              <p>
                利用できない機能はグレーアウトされ、対象プランの案内が表示されます。
              </p>
            </ManualSection>

            <ManualSection id="integrations" role="admin" title="14. API/Webhook">
              <p>
                <InlineScreen>API/Webhook</InlineScreen>
                は、YOMITORI DocuTaskで解析・登録した書類やタスクを、外部システムに連携するための機能です。
              </p>
              <p>
                一般利用者が日常的に操作する画面ではありません。運用する場合は、システム管理者と相談してください。
              </p>
              <ManualTable
                rows={[
                  ["APIキー管理", "外部システムからデータを参照するためのキーを管理します"],
                  ["書類API", "外部システムから書類一覧を参照します"],
                  ["タスクAPI", "外部システムからタスク一覧を参照します"],
                  ["Webhook", "書類承認、タスク作成、リマインド送信などを外部へ通知します"],
                  ["送信履歴", "Webhookの成功・失敗を確認します"],
                ]}
              />
              <ImportantBox>
                APIキーやWebhook URLは、外部システムからYOMITORI DocuTaskへアクセスするための重要情報です。取り扱いに注意してください。
              </ImportantBox>
            </ManualSection>

            <ManualSection id="common-actions" role="all" title="15. よくある操作">
              <h3 className="text-lg font-bold text-[#1f2933]">書類を登録してタスク化する</h3>
              <NumberedSteps
                items={[
                  <>
                    <InlineScreen>ダッシュボード</InlineScreen>から
                    <InlineScreen>書類を登録</InlineScreen>を開く
                  </>,
                  "PDF、画像、またはメール本文を登録する",
                  <>
                    <InlineAction>AI抽出</InlineAction>を実行する
                  </>,
                  <>
                    <InlineAction>確認</InlineAction>から
                    <InlineScreen>AI抽出確認・承認</InlineScreen>を開く
                  </>,
                  "書類タイトル、種別、要約、期限、タスク候補を確認する",
                  "必要に応じて修正する",
                  <>
                    <InlineAction>承認してタスク作成</InlineAction>を押す
                  </>,
                  <>
                    <InlineScreen>タスク一覧</InlineScreen>または
                    <InlineScreen>未処理一覧</InlineScreen>で作成されたタスクを確認する
                  </>,
                ]}
              />
              <TipBox title="知っておくと便利な機能: 後から台帳追加">
                <NumberedSteps
                  items={[
                    <>
                      <InlineScreen>書類を登録</InlineScreen>画面内の
                      <InlineAction>台帳設定</InlineAction>または
                      <InlineAction>取引先設定</InlineAction>ボタンを押す
                    </>,
                    <>
                      <InlineScreen>管理対象</InlineScreen>または
                      <InlineScreen>取引先</InlineScreen>を追加する
                    </>,
                    <>
                      <InlineAction>書類登録へ戻る</InlineAction>を押す
                    </>,
                    "入力途中の内容が復元されていることを確認する",
                    "登録を続ける",
                  ]}
                />
              </TipBox>
              <h3 className="text-lg font-bold text-[#1f2933]">期限切れタスクを確認する</h3>
              <NumberedSteps
                items={[
                  <>
                    <InlineScreen>ダッシュボード</InlineScreen>
                    で期限切れまたは期限間近の案内を見る
                  </>,
                  <>
                    <InlineScreen>タスク一覧</InlineScreen>または
                    <InlineScreen>未処理一覧</InlineScreen>を開く
                  </>,
                  "対象タスクの内容、期限、担当者を確認する",
                  "対応が終わったらステータスを完了にする",
                ]}
              />
              <h3 className="text-lg font-bold text-[#1f2933]">送信失敗したリマインドを確認する</h3>
              <NumberedSteps
                items={[
                  <>
                    <InlineScreen>ダッシュボード</InlineScreen>または
                    <InlineScreen>リマインド</InlineScreen>を開く
                  </>,
                  "「送信失敗」のステータスになっているリマインドを確認する",
                  "エラーの原因を確認する",
                  <>
                    修正後、必要に応じて<InlineAction>再送</InlineAction>を押す
                  </>,
                ]}
              />
              <p>
                主な原因は、担当者のメールアドレス誤り、送信元メールサーバーの設定不備、外部メール送信サービスの制限などです。
              </p>
            </ManualSection>

            <ManualSection id="notes" role="all" title="16. 注意事項">
              <ManualTable
                rows={[
                  ["AI抽出結果は必ず人が確認する", "AIが誤って期限や提出物を読み取る可能性があります"],
                  ["期限や提出物は原本と照合する", "業務上の期限漏れを防ぐためです"],
                  ["書類種別、管理対象、取引先を設定する", "後から検索・確認しやすくなります"],
                  ["担当者未設定のタスクを放置しない", "通知や引き継ぎが漏れやすくなります"],
                  ["不要な追加種別の削除に注意する", "その種別を使っていたデータは自動的に【その他】へと変更されます。データ自体は削除されません"],
                  ["API/Webhookは管理者が扱う", "外部システム連携に関わる重要設定のためです"],
                ]}
              />
            </ManualSection>

            <ManualSection id="support" role="all" title="17. 問い合わせ時に伝えるとよい情報">
              <ManualTable
                rows={[
                  ["発生した画面名", "【書類を登録】、【AI抽出確認・承認】など"],
                  ["操作した日時", "2026-06-09 10:30頃"],
                  ["書類IDまたはタスクID", "URLに含まれるUUIDなど"],
                  ["表示されたエラー", "画面上のエラーメッセージ"],
                  ["登録したファイル形式", "PDF、PNG、JPEG、メール本文など"],
                  ["対象の管理対象・取引先", "物件名、施設名、取引先名など"],
                  ["利用中のプラン", "Personal、Business、Pro、Enterpriseなど"],
                  ["初期設定画面の確認結果", "運用チェック項目の表示内容"],
                ]}
              />
              <p>
                書類IDは、<InlineScreen>AI抽出確認・承認</InlineScreen>
                画面のURLに含まれるUUIDです。
              </p>
            </ManualSection>
          </div>
        </div>
      </div>
    </main>
  );
}
