# YOMITORI DocuTask TENsNAP流用調査

## 1. 調査対象

対象リポジトリ:

```text
C:\Users\use\dev\score-snap
```

目的:

TENsNAP の既存実装から、YOMITORI DocuTask に流用できる技術資産を切り分ける。

## 2. 結論

TENsNAP は Next.js + OpenNext + Cloudflare Workers + R2 + Neon + NextAuth + OpenAI + Stripe の構成で、YOMITORI DocuTask の予定技術構成とかなり近い。

ただし、TENsNAP は教育・答案分析に強く最適化されているため、業務ロジックをそのまま持ち込むべきではない。

流用方針:

- 技術基盤はかなり流用できる
- AI呼び出し、R2保存、NextAuth、Stripe webhook の骨格は流用できる
- DBスキーマ、テナント管理、OCR/AIプロンプト、ダッシュボードUIはYOMITORI専用に作り直す
- TENsNAP固有の生徒、教科、答案、端末制限、family/schoolプランは基本的に持ち込まない

## 3. 構成概要

### フレームワーク

- Next.js 16.1.5
- React 18.3.1
- TypeScript
- Tailwind CSS
- OpenNext Cloudflare

根拠:

- `package.json`
- `next.config.ts`
- `open-next.config.ts`
- `wrangler.jsonc`

### 主な依存

- `@neondatabase/serverless`
- `pg`
- `next-auth`
- `openai`
- `stripe`
- `react-dropzone`
- `lucide-react`
- `@react-pdf/renderer`
- `nodemailer`
- `@opennextjs/cloudflare`

YOMITORIでも使う可能性が高い。

## 4. そのまま流用しやすいもの

### 4.1 Next.js / OpenNext / Cloudflare 構成

流用度: 高

該当:

- `package.json`
- `wrangler.jsonc`
- `open-next.config.ts`
- `next.config.ts`

TENsNAP は OpenNext の Cloudflare Workers 配信構成がすでに動いている。

YOMITORIで必要な変更:

- Worker名
- R2 binding名
- bucket名
- cookie domain
- service URL
- Stripeリンク・価格ID
- metadata

注意:

`wrangler.jsonc` は TENsNAP 固有値が多い。設定ファイルの形は流用し、値は新規作成する。

特に変更する値:

- `name`
- `r2_buckets.binding`
- `r2_buckets.bucket_name`
- `NEXTAUTH_COOKIE_DOMAIN`
- `FAMILY_HOST` 系は削除
- `STRIPE_SCHOOL_*` / `STRIPE_FAMILY_*` は削除

## 5. 修正して流用するもの

### 5.1 DB接続

流用度: 高

該当:

```text
C:\Users\use\dev\score-snap\lib\db.ts
```

内容:

- `@neondatabase/serverless` の `neon()` を使う軽量query wrapper
- `ECONNRESET` 時にクライアントを作り直して1回再試行

YOMITORIでの方針:

- ほぼそのまま流用
- 型名やエラー処理だけ整える
- transaction が必要な承認処理では、別途 `pg` Pool またはNeon transaction対応を検討する

注意:

YOMITORIの承認処理は documents / tasks / reminders / approvals / audit_logs を一括更新するため、単発query wrapperだけでは弱い。承認API用にtransaction helperを追加する。

### 5.2 OpenAIクライアント

流用度: 高

該当:

```text
C:\Users\use\dev\score-snap\lib\openai_client.ts
```

内容:

- OpenAI clientのsingleton
- Cloudflare/OpenNext runtime向けにruntime-native fetchを指定
- retry helper
- error serializer

YOMITORIでの方針:

- ほぼそのまま流用
- モデル、timeout、retry回数はYOMITORI側で調整
- JSON Schema検証を追加

YOMITORIで追加するもの:

- `runDocumentExtraction()`
- `normalizeAiExtraction()`
- `validateAiExtractionSchema()`
- prompt_version / schema_version保存

### 5.3 R2保存

流用度: 中から高

該当:

```text
C:\Users\use\dev\score-snap\lib\r2_assets.ts
```

内容:

- OpenNextの `getCloudflareContext`
- R2 binding取得
- object key生成
- 複数ファイルのR2保存

YOMITORIでの方針:

- R2 binding取得ロジックは流用
- key設計は作り直す
- `answer` / `problem` のカテゴリは使わない

YOMITORI用key案:

```text
documents/{organizationId}/{documentId}/original/{fileId}-{safeName}
documents/{organizationId}/{documentId}/pages/{pageNumber}.png
documents/{organizationId}/{documentId}/processed/{fileId}.json
```

追加で必要:

- 署名付きURL発行
- ファイル削除または論理削除との整合
- PDF / image / text のfile_role管理

### 5.4 NextAuth / Googleログイン

流用度: 中

該当:

```text
C:\Users\use\dev\score-snap\app\api\auth\[...nextauth]\route.ts
C:\Users\use\dev\score-snap\lib\custom-adapter.ts
C:\Users\use\dev\score-snap\components\Providers.tsx
```

内容:

- NextAuth
- GoogleProvider
- EmailProvider
- JWT session
- custom PostgreSQL adapter
- shared cookie domain
- session kickout guard

YOMITORIでの方針:

- GoogleProviderとSessionProvider構成は流用
- CustomPostgresAdapterはYOMITORIのusers/accounts schemaに合わせて修正
- EmailProviderはMVPでは不要なら外す
- session kickout guardはMVPでは簡略化

注意:

TENsNAPの認証は既存DBスキーマに強く依存している。YOMITORIのDDLでは `users` の構造が違うため、adapterはそのままでは使えない。

YOMITORIでは以下に合わせる。

- `users`
- `organization_members`
- 必要なら `accounts` / `verification_tokens` をDDLへ追加

現DDLにはNextAuth標準の `accounts` / `verification_tokens` が未定義なので、NextAuthを使うなら追加migrationが必要。

### 5.5 Stripe webhook

流用度: 中

該当:

```text
C:\Users\use\dev\score-snap\lib\stripe.ts
C:\Users\use\dev\score-snap\app\api\stripe\webhook\route.ts
```

内容:

- Stripe client
- Cloudflare/OpenNext向けfetch http client
- webhook署名検証
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted

YOMITORIでの方針:

- Stripe clientはほぼ流用
- webhook署名検証は流用
- organization更新処理はYOMITORIの `subscriptions` / `usage_periods` に合わせて作り直す

YOMITORIで必要:

- `subscriptions` upsert
- `usage_periods` 作成
- extra pack checkout
- `stripe_events` でidempotency管理
- `organizations.plan_code` 更新

TENsNAPのcheckoutはPayment Link中心なので、YOMITORIのサブスク/追加パックCheckoutとは作り替えが必要。

### 5.6 アップロードUI

流用度: 中

該当:

```text
C:\Users\use\dev\score-snap\components\dashboard\MultiUploadArea.tsx
C:\Users\use\dev\score-snap\components\dashboard\UploadArea.tsx
```

内容:

- react-dropzone
- 複数画像アップロード
- クライアント側画像リサイズ
- サムネイル表示
- ページ番号表示

YOMITORIでの方針:

- dropzone、サムネイル、複数ページUIは流用
- UI文言、accept設定、PDF対応、ファイル種別表示を追加
- 画像リサイズは、原本保存が必要な業務書類では慎重に扱う

重要:

YOMITORIでは証跡管理が価値なので、原本は劣化させず保存する。リサイズ画像はプレビュー用に限定する。

### 5.7 データ保持・削除ジョブ

流用度: 中

該当:

```text
C:\Users\use\dev\score-snap\lib\dataRetention.ts
C:\Users\use\dev\score-snap\app\api\internal\retention\cleanup\route.ts
```

内容:

- secret headerによる内部cleanup endpoint
- trial / canceled の猶予期間
- dry run
- batch処理

YOMITORIでの方針:

- endpoint構造、secret header、dry run、batch処理の考え方は流用
- 対象テーブルはYOMITORIのdocuments/tasks/files系へ全面修正
- R2オブジェクト削除も追加が必要

YOMITORIで削除対象:

- documents
- document_files
- document_pages
- ai_extractions
- extracted_items
- tasks
- reminders
- notifications
- document_approvals
- audit_logs
- R2原本/プレビュー

ただし監査ログを削除するか保持するかは利用規約と保持ポリシー次第。

## 6. 一部だけ参考にするもの

### 6.1 OCR / AI分析サービス

流用度: 低から中

該当:

```text
C:\Users\use\dev\score-snap\lib\ocr_service.ts
```

内容:

- OpenAI visionに画像をbase64で渡す
- JSON出力を要求
- かなり大きな教育/採点専用プロンプト
- 教科別辞書や正答率補正ロジック

YOMITORIでの方針:

- `OpenAIに画像/テキストを渡してJSONを得る実装パターン` だけ参考にする
- プロンプト、型、後処理、辞書、スコア補正は流用しない
- YOMITORI専用の `document_extraction_service.ts` を新規作成する

使える考え方:

- `response_format: { type: "json_object" }`
- retry wrapper
- raw JSON保存
- 出力後の正規化
- subject-specific guardに相当する、document_type-specific guard

YOMITORIで必要な別実装:

- OCRテキスト入力
- PDFページテキスト
- AI抽出JSONスキーマ
- source_refs
- confidence
- warnings
- task_candidates
- reminder_candidates

### 6.2 `/api/upload`

流用度: 低から中

該当:

```text
C:\Users\use\dev\score-snap\app\api\upload\route.ts
```

内容:

- session確認
- tenant解決
- formDataから複数ファイル取得
- R2保存
- AI分析実行
- DB保存
- 結果JSON返却

YOMITORIでの方針:

- 処理の流れは参考になる
- ただしYOMITORIではAPIを分割する

YOMITORIでは分ける:

- `POST /documents`
- `POST /documents/:id/files`
- `POST /documents/:id/files/:fileId/complete`
- `POST /documents/:id/process`
- `GET /documents/:id/review`
- `POST /documents/:id/approve`

理由:

TENsNAPは「アップロードして即分析して結果表示」だが、YOMITORIは「台帳・承認・タスク化」があるため、処理を分割した方が安全。

## 7. 持ち込まない方がよいもの

### 7.1 TENsNAP固有DBスキーマ

該当:

```text
C:\Users\use\dev\score-snap\scripts\setup_db.js
```

理由:

- `students`
- `uploads`
- `analyses`
- `problem_sheets`
- `org_devices`
- `school/family account_plan`

これらはYOMITORIの業務書類台帳とは合わない。

注意:

`setup_db.js` は過去migrationの寄せ集めに近い。YOMITORIでは、今回作成したDDLを基準にmigration管理する方がよい。

### 7.2 端末制限・trial abuse検知

該当:

```text
C:\Users\use\dev\score-snap\app\api\org\device\check\route.ts
C:\Users\use\dev\score-snap\lib\billingAuthorization.ts
```

理由:

- TENsNAPのスクール/家庭向け課金モデルに寄っている
- YOMITORIの管理会社向けMVPでは、複数担当者・組織利用が前提
- 端末制限はBusiness/Proの価値と衝突する可能性がある

YOMITORIでは代わりに:

- organization_members
- role
- usage limit
- audit_logs

### 7.3 Dashboardコンポーネントの大部分

該当:

```text
C:\Users\use\dev\score-snap\components\dashboard\Dashboard.tsx
```

理由:

- 生徒、教科、テスト、理解度、受験期モードに強く依存
- 1ファイル内の状態が大きく、YOMITORIの画面群には分割した方がよい

流用できるのは:

- fetchの進捗状態管理の考え方
- アップロード後のステータス表示
- エラー表示

UIそのものは、YOMITORI向けに新規設計する。

## 8. YOMITORI向けに新規作成すべきもの

### 8.1 DB migration

作成済みDDL:

```text
YOMITORI_DocuTask_neon_ddl.sql
```

追加検討:

- NextAuth用 `accounts`
- NextAuth用 `verification_tokens`
- session strategyをJWTのみにするならDB session tableは不要

### 8.2 認可ヘルパー

必要:

- `getCurrentUser()`
- `getCurrentOrganization()`
- `requireOrganizationMember()`
- `requireRole()`
- `assertSameOrganization()`

TENsNAPの `getTenantId()` はYOMITORIでは使わない。

### 8.3 Document API群

新規:

- `/api/documents`
- `/api/documents/:id`
- `/api/documents/:id/files`
- `/api/documents/:id/process`
- `/api/documents/:id/review`
- `/api/documents/:id/approve`
- `/api/monthly-open-items`

### 8.4 AI抽出サービス

新規:

- `lib/document_extraction_service.ts`
- `lib/ai_extraction_schema.ts`
- `lib/ai_extraction_normalize.ts`
- `lib/ai_extraction_validate.ts`

### 8.5 承認画面

新規:

- `app/documents/[id]/review/page.tsx`
- `components/review/DocumentReviewLayout.tsx`
- `components/review/DocumentViewer.tsx`
- `components/review/ExtractionForm.tsx`
- `components/review/TaskCandidateEditor.tsx`

### 8.6 台帳・タスク画面

新規:

- `app/documents/page.tsx`
- `app/tasks/page.tsx`
- `app/monthly-open-items/page.tsx`
- `components/documents/DocumentLedger.tsx`
- `components/tasks/TaskList.tsx`

## 9. 環境変数の切り分け

TENsNAPで確認した環境変数名:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `TENANT_ID`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_ALLOWED_COUNTRY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`
- `DATA_RETENTION_CRON_SECRET`
- `DATA_RETENTION_TRIAL_GRACE_DAYS`
- `DATA_RETENTION_CANCELED_GRACE_DAYS`
- `DATA_RETENTION_BATCH_SIZE`

YOMITORIで使う:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ALLOWED_COUNTRY`
- `EMAIL_*`
- `DATA_RETENTION_*`

YOMITORIでは使わない:

- `TENANT_ID`
- `FAMILY_HOST`
- `NEXT_PUBLIC_FAMILY_HOST`
- `STRIPE_SCHOOL_*`
- `STRIPE_FAMILY_*`

YOMITORIで追加:

- `YOMITORI_R2_BUCKET_BINDING`
- `DOCUMENT_PROCESSING_MAX_REPROCESS_COUNT`
- `OPENAI_DOCUMENT_EXTRACTION_MODEL`
- `APP_BASE_URL`
- `STRIPE_PERSONAL_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`
- `STRIPE_EXTRA_10_PRICE_ID`
- `STRIPE_EXTRA_30_PRICE_ID`

## 10. 実装順への反映

### 最初に流用する

1. package / Next.js / OpenNext構成
2. `lib/db.ts`
3. `lib/openai_client.ts`
4. `lib/r2_assets.ts` をYOMITORI用に改造
5. NextAuthのGoogleログイン構成

### 次に作る

1. YOMITORI用NextAuth schema追加
2. organization/member認可ヘルパー
3. managed_assets / counterparties CRUD
4. documents API
5. text貼り付けからAI抽出
6. 承認画面

### 後回し

1. PDFプレビュー高度化
2. 画像補正
3. Google Calendar API
4. Slack / Teams
5. 差分比較
6. 監査ログ閲覧UI

## 11. 注意点

### NextAuth用テーブルが不足

TENsNAPの custom adapter は `accounts` と `verification_tokens` を使うが、YOMITORI用DDLにはまだ入れていない。

対応:

- JWT + GoogleProviderだけで最小構成にする
- それでもAdapterを使うなら `accounts` / `verification_tokens` を追加する

推奨:

YOMITORIではDBにユーザーを確実に持つ必要があるため、NextAuth adapterをYOMITORI schemaに合わせて作る。

### 承認処理にはtransaction helperが必要

TENsNAPの `query()` は単発query向け。

YOMITORIの承認処理は複数テーブルを同時更新するため、transaction対応を追加する。

対象:

- documents
- document_assets
- extracted_items
- document_approvals
- tasks
- reminders
- audit_logs
- notifications

### R2は原本保存を優先

TENsNAPのMultiUploadAreaは画像をリサイズしている。

YOMITORIでは証跡性が重要なので、原本は無加工で保存する。リサイズはプレビュー用だけに使う。

### AIプロンプトは作り直し

TENsNAPの `ocr_service.ts` は教育分析専用で巨大。YOMITORIには持ち込まない。

YOMITORIでは、作成済みの `YOMITORI_DocuTask_AI_extraction_schema.md` を基準に新規実装する。

## 12. 次の具体作業

1. YOMITORIプロジェクトの置き場所を決める
2. TENsNAPからpackage/configの最小セットをコピー
3. YOMITORI用 `wrangler.jsonc` を作成
4. YOMITORI用NextAuth schemaをDDLに追加するか決める
5. `lib/db.ts` / `lib/openai_client.ts` / `lib/r2_assets.ts` を移植
6. `getCurrentOrganization()` 系の認可ヘルパーを新規作成
7. text貼り付けのAI抽出APIから実装開始
