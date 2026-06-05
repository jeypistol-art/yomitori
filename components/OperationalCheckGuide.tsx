import {
  AlertTriangle,
  BellRing,
  Bot,
  Clock3,
  CreditCard,
  Database,
  FileWarning,
  HardDrive,
  KeyRound,
  Mail,
  ShieldAlert,
  Webhook,
} from "lucide-react";

const checkGroups = [
  {
    title: "環境変数未設定",
    body: "設定値が空、Cloudflare側に未登録、またはローカルと本番で値がずれている時に発生します。",
    icon: KeyRound,
    items: [
      "`DATABASE_URL` が未設定の場合、Neon接続と画面表示が失敗します。",
      "R2系の設定やbindingが不一致の場合、書類登録時のファイル保存が失敗します。",
      "`OPENAI_API_KEY` が未設定の場合、AI抽出が失敗します。",
      "`RESEND_API_KEY` または `EMAIL_FROM` が未設定の場合、リマインド送信が失敗します。",
      "Stripe系のsecret、price id、webhook secretが未設定の場合、課金処理やプラン反映が失敗します。",
      "`NOTIFICATION_JOB_SECRET` が未設定または不一致の場合、Cronジョブからの通知処理が失敗します。",
    ],
  },
  {
    title: "外部サービス疎通失敗",
    body: "設定値は存在していても、認証エラー、権限不足、レート制限、外部サービス障害で失敗するケースです。",
    icon: ShieldAlert,
    items: [
      "Neonが接続不可の場合、ほぼ全画面のデータ取得が失敗します。",
      "R2がPUT/GET不可の場合、書類登録または原本表示が失敗します。",
      "OpenAI APIが401、429、5xxを返す場合、AI抽出が失敗または遅延します。",
      "Resend APIが401、429、5xxを返す場合、リマインドメールが失敗します。",
      "Stripe APIが401または5xxを返す場合、Checkout、Portal、同期処理が失敗します。",
    ],
  },
  {
    title: "運用異常",
    body: "外部サービスは動いていても、業務上の未処理や失敗が残っている状態です。",
    icon: FileWarning,
    items: [
      "Cronが一定時間実行されていない場合、リマインドとWebhook送信が止まります。",
      "リマインド送信失敗が残る場合、Resend設定、送信元、レート制限を確認します。",
      "Webhook配信失敗または停止が残る場合、送信先URL、受信側ステータス、署名検証を確認します。",
      "Stripe webhook未処理または失敗が残る場合、Stripe DashboardのWebhook配信履歴とアプリ側履歴を確認します。",
      "外部API 4xx/5xxが増えている場合、APIキー、スコープ、連携先の実装を確認します。",
      "未処理書類や期限切れタスクが増えている場合、担当者割当、承認待ち、通知ルールを確認します。",
    ],
  },
  {
    title: "設定不整合",
    body: "単体では正しく見えても、サービス間のモードやURLが噛み合っていない状態です。",
    icon: AlertTriangle,
    items: [
      "R2バケット名、binding名、Cloudflare側のバケット設定が一致しているか確認します。",
      "Stripeのsecret key、price id、webhook secretがsandbox/liveで混在していないか確認します。",
      "Resend送信元ドメインのSPF/DKIM認証が完了しているか確認します。",
      "Google OAuthのcallback URLが `https://yomitori.org/api/auth/callback/google` と一致しているか確認します。",
      "Cron secretがCloudflare環境変数とアプリ側の期待値で一致しているか確認します。",
    ],
  },
];

const quickChecks = [
  { label: "Neon接続", target: "画面全体のデータ取得、/setup、/dashboard", icon: Database },
  { label: "R2接続", target: "画像/PDF登録、原本表示、R2バケットのオブジェクト", icon: HardDrive },
  { label: "OpenAI API", target: "AI抽出、抽出結果、Cloudflareログ", icon: Bot },
  { label: "Resend", target: "リマインドメール、送信失敗ログ、Resend Activity", icon: Mail },
  { label: "Stripe", target: "Checkout、Portal、Webhook、プラン反映", icon: CreditCard },
  { label: "Cron", target: "Cloudflare Cron Events、リマインド/Webhook送信", icon: Clock3 },
  { label: "Webhook", target: "/integrations の配信履歴、受信側ログ", icon: Webhook },
  { label: "通知", target: "/reminders、送信失敗、担当者メール", icon: BellRing },
];

export default function OperationalCheckGuide() {
  return (
    <section className="space-y-5">
      <div className="border border-[#d9ded3] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
          Operations
        </p>
        <h2 className="mt-1 text-xl font-bold">運用チェック項目</h2>
        <p className="mt-2 text-sm leading-6 text-[#4b5563]">
          正常時に見る場所と、異常時に疑う原因をまとめています。エラー発生時、お問い合わせにご活用ください。
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quickChecks.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="border border-[#d9ded3] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#edf2e8] text-[#2f5d50]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">{item.label}</h3>
                  <p className="mt-2 text-xs leading-5 text-[#6b7280]">
                    {item.target}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {checkGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article key={group.title} className="border border-[#d9ded3] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff8eb] text-[#9a5b13]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold">{group.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    {group.body}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {group.items.map((item) => (
                  <p
                    key={item}
                    className="border border-[#edf0ea] bg-[#fbfcf8] px-3 py-2 text-sm leading-6 text-[#4b5563]"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
