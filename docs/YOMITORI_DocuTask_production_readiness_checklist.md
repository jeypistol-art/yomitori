# YOMITORI DocuTask 本番前チェックリスト

最終更新日: 2026年5月29日

このチェックリストは、実ユーザー受け入れまたは本番決済を開始する前の最終確認用です。Cloudflareへのデプロイ完了後、`https://yomitori.org` に対して実行します。

テスト用の書類、タスク、問い合わせ送信には `[launch-test]` を付けて、後で削除しやすくします。

## 0. Go / No-Go 判定

以下の `必須` が残っている間は、本番運用へ切り替えない。

| 領域 | 必須条件 |
| --- | --- |
| 認証 | Googleログインが `https://yomitori.org` で完結し、localhostへ戻らない |
| DB | Neonの本番DBに接続され、migrationが適用済み |
| 保管 | R2アップロードが成功し、バケットが公開状態になっていない |
| AI処理 | テキスト書類とファイル書類を解析・承認できる |
| 課金 | Stripe決済、プラン変更、追加パック、ポータル、Webhook反映が動く |
| 通知 | リマインドメールがlogではなく本番送信プロバイダから届く |
| 法務 | 利用規約、プライバシーポリシー、特商法表記、問い合わせ先が表示される |
| セキュリティ | 本番secretがGitHubへ入っておらず、Cloudflare等にのみ設定されている |

## 1. 環境変数

### Cloudflare Worker

- [ ] `APP_BASE_URL=https://yomitori.org`
- [ ] `NEXTAUTH_URL=https://yomitori.org`
- [ ] `NEXTAUTH_SECRET` は本番専用のランダム値
- [ ] `DATABASE_URL` はNeon本番DBを指している
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` は本番OAuthクライアント
- [ ] `OPENAI_API_KEY` が設定済みで、利用上限・課金設定に問題がない
- [ ] `OPENAI_DOCUMENT_EXTRACTION_MODEL=gpt-4o-mini` または意図したモデル
- [ ] `R2_BUCKET_NAME=yomitori-docutask-documents`
- [ ] R2 binding `YOMITORI_DOCUMENTS` が `wrangler.jsonc` とCloudflare側で一致
- [ ] `STRIPE_SECRET_KEY` が想定モードと一致している（sandboxまたはlive）
- [ ] Stripe Price IDが同一モードで揃っている
  - [ ] `STRIPE_PERSONAL_PRICE_ID`
  - [ ] `STRIPE_BUSINESS_PRICE_ID`
  - [ ] `STRIPE_PRO_PRICE_ID`
  - [ ] `STRIPE_ENTERPRISE_PRICE_ID`
  - [ ] `STRIPE_EXTRA_10_PRICE_ID`
  - [ ] `STRIPE_EXTRA_30_PRICE_ID`
- [ ] `STRIPE_WEBHOOK_SECRET` は `https://yomitori.org/api/stripe/webhook` の署名secret
- [ ] `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` は使用中のポータル設定ID
- [ ] `RESEND_API_KEY` が設定済み
- [ ] `EMAIL_FROM` はResendで検証済みの送信元
- [ ] `EMAIL_DELIVERY_MODE` は空または `send`
- [ ] `NOTIFICATION_JOB_SECRET` は十分に長く推測困難
- [ ] `NOTIFICATION_JOB_BATCH_SIZE=50` または意図した件数
- [ ] 法務表示の値が設定済み
  - [ ] `LEGAL_BUSINESS_NAME`
  - [ ] `LEGAL_REPRESENTATIVE_NAME`
  - [ ] `LEGAL_ADDRESS`
  - [ ] `LEGAL_PHONE`
  - [ ] `LEGAL_CONTACT_EMAIL=info.yomitori@morimori-labo.monster`
  - [ ] `LEGAL_SUPPORT_HOURS`
  - [ ] `LEGAL_LAST_UPDATED`

### 外部サービスの整合性

- [ ] Stripeのsecret key、Price ID、Webhook secret、Portal設定が同じモードで統一されている
- [ ] Google OAuthの承認済みリダイレクトURIに `https://yomitori.org/api/auth/callback/google` がある
- [ ] Resendのドメイン認証、SPF、DKIMが完了している
- [ ] Neonの接続先が一時的な開発ブランチではない
- [ ] Cloudflare Workerが正しいGitHubリポジトリとブランチからデプロイされている

## 2. 公開ページ

- [ ] `https://yomitori.org/` が開く
- [ ] ヘッダーの `導入相談` が `/enterprise/contact` へ遷移する
- [ ] ヘッダーの `ダッシュボード` が `/dashboard` またはログインへ遷移する
- [ ] `書類を登録` が `/documents/new` またはログインへ遷移する
- [ ] `未処理一覧` が `/unprocessed` またはログインへ遷移する
- [ ] `プランを見る` が `/usage` またはログインへ遷移する
- [ ] フッターの `利用規約` が `/legal/terms` へ遷移する
- [ ] フッターの `プライバシーポリシー` が `/legal/privacy` へ遷移する
- [ ] フッターの `特商法表記` が `/legal/specified-commercial-transactions` へ遷移する
- [ ] フッターの `お問い合わせ` が `/enterprise/contact` へ遷移する
- [ ] 法務ページの連絡先が `info.yomitori@morimori-labo.monster` になっている
- [ ] 特商法表記の事業者情報に、本番公開してよい情報だけが表示されている

## 3. 認証・初期設定

- [ ] シークレットブラウザまたはログアウト状態で開始する
- [ ] `https://yomitori.org/login` からGoogleログインできる
- [ ] ログイン後に `https://yomitori.org` 配下へ戻る
- [ ] 初期組織とメンバーが作成される
- [ ] `/dashboard` が表示される
- [ ] `/setup` が表示される
- [ ] 必要な初期項目を登録できる
- [ ] `/team` がAPIエラーなしで表示される

## 4. 書類登録・AI解析

### テキスト入力

- [ ] `/documents/new` を開く
- [ ] `[launch-test]` を含むメール本文を貼り付ける
- [ ] 件名、期限、対応事項、送信元が含まれている
- [ ] 登録後、登録済み書類一覧に表示される
- [ ] 解析を実行できる
- [ ] `/documents/{id}/review` が表示される
- [ ] 要約、タスク候補、期限、優先度、担当者欄が表示される
- [ ] 承認できる
- [ ] `/tasks` にタスクが表示される
- [ ] `/unprocessed` に未完了タスクが表示される
- [ ] `/audit-logs` に承認ログが表示される

### PDF / 画像アップロード

- [ ] 小さなPDFまたはPNGを登録できる
- [ ] R2に対象オブジェクトが作成される
- [ ] レビュー画面で原本プレビューまたは取得ができる
- [ ] 解析を実行できる
- [ ] タスクを1件承認できる
- [ ] 不要になったテスト書類を削除できる
- [ ] 削除済み書類が一覧から消える

### 重複検知

- [ ] 同じテキスト書類を2回登録する
- [ ] 重複警告が表示される
- [ ] 重複したテスト書類を削除できる

## 5. タスク・リマインド・メール通知

- [ ] 近い時刻のリマインドを持つタスクを作成する
- [ ] `/reminders` に表示される
- [ ] 書類タイトルと通知方法が表示される
- [ ] 手動で通知ジョブを1回実行する

```powershell
$secret = "<NOTIFICATION_JOB_SECRET>"
Invoke-RestMethod `
  -Method POST `
  -Uri "https://yomitori.org/api/jobs/send-reminders?limit=1" `
  -Headers @{ "x-job-secret" = $secret }
```

- [ ] レスポンスに `scanned`, `sent`, `failed`, `canceled_completed` が含まれる
- [ ] 対象リマインドがある場合、`sent` が増える
- [ ] メールが担当者に届く
- [ ] 送信元が設定済みの `EMAIL_FROM` になっている
- [ ] CloudflareログにResend rate limitが出ていない
- [ ] タスク完了後に再実行すると、不要な通知が送られない

## 6. Cloudflare Cron

現在のスケジュールは `wrangler.jsonc` の `*/15 * * * *`。

- [ ] Cloudflare WorkerのTriggersにCron `*/15 * * * *` が表示される
- [ ] Cronイベント履歴が成功になっている
- [ ] Cloudflareログに `[cron] ... fired` が出る
- [ ] Cloudflareログに `[cron:send-reminders] completed` が出る
- [ ] `NOTIFICATION_JOB_SECRET is not configured` が出ていない

## 7. Stripe課金

まずsandboxで全項目を通す。live modeで実施するのはsandbox確認後。

### 新規サブスクリプション

- [ ] `/usage` を開く
- [ ] 現在プラン表示が正しい
- [ ] PersonalからBusinessへ変更する
- [ ] Stripe Checkoutが開く
- [ ] 決済を完了する
- [ ] `/usage` に戻る
- [ ] 再操作なしでプラン表示が反映される
- [ ] `契約状態` が有効または想定状態になる
- [ ] `Stripe Webhook` パネルに処理済みイベントが表示される
- [ ] `/audit-logs` に契約作成または契約状態変更が表示される

### プラン変更

- [ ] BusinessからProへ変更する
- [ ] Stripe Billing Portalの確認画面が開く
- [ ] 変更を完了する
- [ ] `/usage` に戻る
- [ ] プランと月次上限が更新される
- [ ] ProからEnterpriseへ変更する
- [ ] 支払いまたは確認画面が表示される
- [ ] Enterpriseが反映される
- [ ] 同じプランへ変更しようとしても、不要なStripe変更が作られない

### 追加パック

- [ ] `追加10件パック` を購入する
- [ ] `/usage` に戻る
- [ ] 当月利用枠が10件増える
- [ ] `追加30件パック` を購入する
- [ ] 当月利用枠が30件増える
- [ ] Webhookイベントが重複処理されていない

### 請求管理・解約

- [ ] `請求・支払いを管理` を押す
- [ ] Stripe Portalが開く
- [ ] 支払い方法変更画面へ進める
- [ ] 期間終了時解約を設定する
- [ ] `/usage` へ戻る
- [ ] 契約状態に解約予定が表示される
- [ ] `/audit-logs` に `解約予定` が表示される
- [ ] 必要に応じて解約予定を取り消す
- [ ] `/usage` で解約予定が消える
- [ ] `/audit-logs` に `解約予定取消` が表示される

## 8. プラン制限とアップグレードUX

- [ ] Personalで複数ユーザー編集が制限される
- [ ] Personalでは、APIエラー前にアップグレード案内が表示される
- [ ] Businessで担当者割当と共有台帳が使える
- [ ] Pro限定機能がPersonal/Businessで適切に無効表示される
- [ ] 準備中機能はクリックできず、`準備中` と表示される
- [ ] Enterprise個別提供は `/enterprise/contact` へつながる

## 9. 導入相談フォーム

- [ ] `/enterprise/contact` を開く
- [ ] 必須項目を入力して送信する
- [ ] 送信完了表示が出る
- [ ] Googleフォーム側に回答が記録される
- [ ] Googleフォームを使っている見た目が出ていない
- [ ] `相談したい内容` 未選択で送信すると、画面上にエラーが出る
- [ ] 不正なメールアドレスは送信できない
- [ ] CloudflareログにGoogle Forms `400` が出ていない

## 10. データ・セキュリティ

- [ ] R2バケットの公開アクセスが無効
- [ ] アップロード済みファイルは認証済みアプリ経由でのみ取得できる
- [ ] 削除済み書類が一覧に出ない
- [ ] URLの書類IDを書き換えても他組織の書類へアクセスできない
- [ ] Team / Member APIがプラン権限外の操作を拒否する
- [ ] Billing APIが管理者権限を要求する
- [ ] Reminder job APIが不正な `x-job-secret` を拒否する
- [ ] Stripe Webhookが署名なしリクエストを拒否する
- [ ] Cloudflareログにsecretが出ていない
- [ ] GitHubにsecretがコミットされていない

## 11. Neon確認クエリ

スモークテスト後にNeon SQL Editorで確認する。

```sql
select plan_code, count(*)
from organizations
group by plan_code
order by plan_code;

select status, count(*)
from subscriptions
group by status
order by status;

select event_type, processing_status, count(*)
from stripe_webhook_events
group by event_type, processing_status
order by event_type, processing_status;

select status, count(*)
from reminders
group by status
order by status;
```

期待値:

- [ ] `failed` のWebhookイベントが残っていない、または理由を説明できる
- [ ] `subscriptions` の状態がStripe Dashboardと一致する
- [ ] Reminder failureが想定内
- [ ] `[launch-test]` のテストデータを後で識別できる

## 12. 公開後24時間の監視

- [ ] Cloudflare Workerのエラー
- [ ] Stripe Webhook delivery status
- [ ] Resendの配信エラーとrate limit
- [ ] Neon接続エラー
- [ ] R2オブジェクト増加量
- [ ] OpenAI APIエラーと利用額
- [ ] 実ユーザーのログイン成功
- [ ] 書類登録成功
- [ ] 主要ページで401/402/500のループが起きていない

## 13. テスト後の掃除

- [ ] `[launch-test]` 書類を削除する
- [ ] `[launch-test]` タスクを完了または削除する
- [ ] テストリマインドを削除またはキャンセルする
- [ ] Stripe sandboxのテスト顧客とlive顧客を混ぜない
- [ ] liveでテスト決済した場合、返金要否を記録する
- [ ] 最終Go / No-Goと残課題を記録する

## 14. 公開時に明示しておく制限

- [ ] AI抽出は補助であり、人間の確認が必要
- [ ] `準備中` の機能はまだ利用できない
- [ ] Enterpriseのカスタムルール、API/Webhookは個別相談
- [ ] メール通知時刻はCron間隔とメールプロバイダの配信状況に依存する
- [ ] 外部サービス障害により、解析、決済反映、通知が遅れる場合がある
