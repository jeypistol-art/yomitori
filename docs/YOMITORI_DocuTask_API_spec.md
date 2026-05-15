# YOMITORI DocuTask API詳細仕様

## 1. 前提

### 対象

MVP実装で必要なAPI仕様。

初期ターゲットは、不動産・施設などの管理会社。初期対応書類は行政・自治体通知、契約更新案内、リース・保険・テナント更新案内を中心にする。

### ベースURL

```text
/api
```

### 認証

Google Auth によるログイン済みセッションを前提にする。

MVPでは、ブラウザアプリからのAPIアクセスはセッションクッキーで認証する。API/Webhook外部公開はEnterprise以降の後続機能とする。

### データスコープ

すべての業務データは organization_id で分離する。

APIでは、現在選択中の組織を current organization として扱う。ユーザーが所属していない組織のデータにはアクセスできない。

## 2. 共通仕様

### Content-Type

```http
Content-Type: application/json
```

ファイルアップロード関連のみ multipart/form-data または署名付きURLを使う。

### レスポンス形式

成功:

```json
{
  "data": {},
  "meta": {}
}
```

エラー:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容を確認してください。",
    "details": []
  }
}
```

### ページネーション

一覧APIは cursor pagination を基本にする。

リクエスト:

```text
?limit=50&cursor=...
```

レスポンス:

```json
{
  "data": [],
  "meta": {
    "next_cursor": "cursor-value",
    "has_more": true
  }
}
```

### 日時

- API入出力は ISO 8601
- 保存は timestamptz
- 日付のみの期限は YYYY-MM-DD
- 初期タイムゾーンは Asia/Tokyo

### ID

すべて UUID。

### 共通エラーコード

| code | HTTP | 説明 |
|---|---:|---|
| UNAUTHORIZED | 401 | 未ログイン |
| FORBIDDEN | 403 | 権限不足 |
| NOT_FOUND | 404 | 対象なし |
| VALIDATION_ERROR | 422 | 入力エラー |
| USAGE_LIMIT_EXCEEDED | 402 | 処理上限到達 |
| SUBSCRIPTION_REQUIRED | 402 | 有効な契約なし |
| PROCESSING_FAILED | 500 | 処理失敗 |
| CONFLICT | 409 | 状態競合 |
| RATE_LIMITED | 429 | レート制限 |

## 3. 権限

### role

- owner
- admin
- member
- viewer

### 権限目安

| 操作 | owner | admin | member | viewer |
|---|---:|---:|---:|---:|
| 組織設定 | yes | no | no | no |
| メンバー招待 | yes | yes | no | no |
| 書類登録 | yes | yes | yes | no |
| AI処理開始 | yes | yes | yes | no |
| 抽出結果修正 | yes | yes | yes | no |
| 承認 | yes | yes | optional | no |
| タスク作成 | yes | yes | yes | no |
| タスク完了 | yes | yes | yes | no |
| 請求管理 | yes | no | no | no |

MVPでは member の承認可否は組織設定で固定してもよい。初期値は member も承認可能。

## 4. Auth / Me

### GET /me

ログインユーザーと所属組織を取得する。

レスポンス:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "山田 太郎",
      "avatar_url": null
    },
    "organizations": [
      {
        "id": "uuid",
        "name": "〇〇管理株式会社",
        "plan_code": "business",
        "role": "owner"
      }
    ],
    "current_organization_id": "uuid"
  }
}
```

## 5. Organizations

### POST /organizations

組織を作成する。

権限: ログインユーザー

リクエスト:

```json
{
  "name": "〇〇管理株式会社",
  "billing_email": "billing@example.com",
  "default_timezone": "Asia/Tokyo"
}
```

レスポンス:

```json
{
  "data": {
    "id": "uuid",
    "name": "〇〇管理株式会社",
    "plan_code": "personal",
    "role": "owner"
  }
}
```

### GET /organizations/current

現在の組織情報を取得する。

レスポンス:

```json
{
  "data": {
    "id": "uuid",
    "name": "〇〇管理株式会社",
    "plan_code": "business",
    "billing_email": "billing@example.com",
    "default_timezone": "Asia/Tokyo",
    "created_at": "2026-05-08T10:00:00+09:00"
  }
}
```

### PATCH /organizations/current

組織設定を更新する。

権限: owner

リクエスト:

```json
{
  "name": "〇〇管理株式会社",
  "billing_email": "billing@example.com",
  "default_timezone": "Asia/Tokyo"
}
```

## 6. Members / Invitations

### GET /organizations/current/members

メンバー一覧。

権限: owner / admin

レスポンス:

```json
{
  "data": [
    {
      "id": "organization_member_uuid",
      "user": {
        "id": "user_uuid",
        "email": "user@example.com",
        "name": "山田 太郎"
      },
      "role": "owner",
      "joined_at": "2026-05-08T10:00:00+09:00"
    }
  ]
}
```

### POST /organizations/current/invitations

メンバーを招待する。

権限: owner / admin

リクエスト:

```json
{
  "email": "member@example.com",
  "role": "member"
}
```

レスポンス:

```json
{
  "data": {
    "id": "uuid",
    "email": "member@example.com",
    "role": "member",
    "expires_at": "2026-05-15T10:00:00+09:00"
  }
}
```

### PATCH /organizations/current/members/:memberId

メンバー権限を更新する。

権限: owner

リクエスト:

```json
{
  "role": "admin"
}
```

## 7. Managed Assets

管理対象。物件・施設・店舗・テナントなど。

### GET /managed-assets

クエリ:

```text
?asset_type=facility&q=ビル&limit=50&cursor=...
```

レスポンス:

```json
{
  "data": [
    {
      "id": "uuid",
      "asset_type": "facility",
      "name": "〇〇ビル",
      "code": "BLD-001",
      "address": "東京都...",
      "parent_id": null
    }
  ],
  "meta": {
    "next_cursor": null,
    "has_more": false
  }
}
```

### POST /managed-assets

権限: owner / admin / member

リクエスト:

```json
{
  "asset_type": "facility",
  "name": "〇〇ビル",
  "code": "BLD-001",
  "address": "東京都...",
  "parent_id": null,
  "memo": null
}
```

### PATCH /managed-assets/:assetId

権限: owner / admin / member

### DELETE /managed-assets/:assetId

論理削除。

権限: owner / admin

## 8. Counterparties

取引先・発行元・契約相手。

### GET /counterparties

クエリ:

```text
?counterparty_type=municipality&q=市&limit=50&cursor=...
```

### POST /counterparties

リクエスト:

```json
{
  "counterparty_type": "municipality",
  "name": "〇〇市 建築安全課",
  "contact_name": "山田",
  "email": "kenchiku@example.jp",
  "phone": "03-0000-0000",
  "address": "東京都...",
  "memo": null
}
```

### PATCH /counterparties/:counterpartyId

### DELETE /counterparties/:counterpartyId

論理削除。

## 9. Documents

### GET /documents

書類台帳一覧。

クエリ:

```text
?status=needs_review&document_type=municipal_notice&asset_id=uuid&counterparty_id=uuid&due_from=2026-06-01&due_to=2026-06-30&limit=50&cursor=...
```

レスポンス:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "消防設備点検結果報告書の提出依頼",
      "document_type": "municipal_notice",
      "status": "needs_review",
      "due_date": "2026-06-30",
      "counterparty": {
        "id": "uuid",
        "name": "〇〇市 建築安全課"
      },
      "managed_assets": [
        {
          "id": "uuid",
          "name": "〇〇ビル"
        }
      ],
      "created_at": "2026-05-08T10:00:00+09:00"
    }
  ],
  "meta": {
    "next_cursor": null,
    "has_more": false
  }
}
```

### POST /documents

書類メタデータを作成する。ファイル本体は別APIでアップロードする。

権限: owner / admin / member

リクエスト:

```json
{
  "title": "消防設備点検結果報告書の提出依頼",
  "document_type": "municipal_notice",
  "source_type": "pdf",
  "counterparty_id": null,
  "managed_asset_ids": [],
  "text_content": null
}
```

レスポンス:

```json
{
  "data": {
    "id": "uuid",
    "status": "draft"
  }
}
```

### GET /documents/:documentId

書類詳細。

レスポンス:

```json
{
  "data": {
    "id": "uuid",
    "title": "消防設備点検結果報告書の提出依頼",
    "document_type": "municipal_notice",
    "status": "approved",
    "summary": "提出期限までに報告書の提出が必要です。",
    "due_date": "2026-06-30",
    "counterparty": {},
    "managed_assets": [],
    "tasks": [],
    "approved_at": "2026-05-08T11:00:00+09:00",
    "approved_by": {}
  }
}
```

### PATCH /documents/:documentId

書類メタデータを更新する。

権限: owner / admin / member

### DELETE /documents/:documentId

論理削除。

権限: owner / admin

## 10. Document Files

### POST /documents/:documentId/files

アップロード対象ファイルを登録し、アップロードURLを発行する。

権限: owner / admin / member

リクエスト:

```json
{
  "file_role": "original",
  "original_filename": "notice.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 123456
}
```

レスポンス:

```json
{
  "data": {
    "file_id": "uuid",
    "upload_url": "https://...",
    "storage_key": "org/document/file/original.pdf",
    "expires_at": "2026-05-08T10:15:00+09:00"
  }
}
```

### POST /documents/:documentId/files/:fileId/complete

アップロード完了を通知する。

リクエスト:

```json
{
  "sha256": "hex",
  "page_count": 3
}
```

レスポンス:

```json
{
  "data": {
    "file_id": "uuid",
    "document_status": "uploaded"
  }
}
```

### GET /documents/:documentId/files/:fileId/signed-url

原本閲覧用の署名付きURLを発行する。

権限: 組織メンバー

レスポンス:

```json
{
  "data": {
    "url": "https://...",
    "expires_at": "2026-05-08T10:15:00+09:00"
  }
}
```

## 11. Processing

### POST /documents/:documentId/process

OCRとAI抽出を開始する。

権限: owner / admin / member

使用件数:

- 初回AI処理開始時に1件消費
- 処理失敗時の返却可否は運用で決める
- 同一書類の再解析はMVPでは件数消費なし。ただし回数制限を設ける

リクエスト:

```json
{
  "mode": "initial",
  "user_instruction": null
}
```

レスポンス:

```json
{
  "data": {
    "job_id": "uuid",
    "document_status": "processing",
    "usage": {
      "used_count": 12,
      "available_count": 300
    }
  }
}
```

エラー:

- USAGE_LIMIT_EXCEEDED
- SUBSCRIPTION_REQUIRED
- CONFLICT

### GET /documents/:documentId/jobs

処理ジョブ一覧。

レスポンス:

```json
{
  "data": [
    {
      "id": "uuid",
      "job_type": "ai_extract",
      "status": "succeeded",
      "attempt_count": 1,
      "started_at": "2026-05-08T10:00:00+09:00",
      "finished_at": "2026-05-08T10:01:00+09:00"
    }
  ]
}
```

## 12. Review / Approval

### GET /documents/:documentId/review

承認画面に必要なデータを一括取得する。

レスポンス:

```json
{
  "data": {
    "document": {},
    "files": [],
    "pages": [],
    "latest_ai_extraction": {},
    "extracted_items": [],
    "review_draft": {},
    "members": [],
    "managed_assets": [],
    "counterparties": []
  }
}
```

### PATCH /documents/:documentId/review-draft

承認前の編集内容を保存する。

権限: owner / admin / member

リクエスト:

```json
{
  "draft_json": {
    "approved_document": {},
    "accepted_items": [],
    "task_creations": [],
    "reminder_creations": [],
    "checked_warning_codes": []
  }
}
```

レスポンス:

```json
{
  "data": {
    "saved_at": "2026-05-08T10:10:00+09:00",
    "version": 3
  }
}
```

### POST /documents/:documentId/approve

抽出結果を承認し、台帳・タスク・リマインドに反映する。

権限: owner / admin / member

リクエスト:

```json
{
  "approved_document": {
    "title": "消防設備点検結果報告書の提出依頼",
    "document_type": "municipal_notice",
    "document_date": "2026-05-01",
    "due_date": "2026-06-30",
    "summary": "消防設備点検結果報告書の提出が必要です。",
    "key_points": [],
    "required_actions": [],
    "required_documents": [],
    "risks": [],
    "counterparty_id": "uuid",
    "managed_asset_ids": ["uuid"]
  },
  "accepted_items": [
    {
      "extracted_item_id": "uuid",
      "accepted": true,
      "edited_value": null
    }
  ],
  "task_creations": [
    {
      "source_extracted_item_id": "uuid",
      "title": "消防設備点検結果報告書を提出する",
      "description": "対象施設の報告書を提出する。",
      "assignee_member_id": "uuid",
      "due_date": "2026-06-30",
      "priority": "high",
      "reminders": [
        {
          "recipient_member_id": "uuid",
          "channel": "email",
          "remind_at": "2026-06-27T09:00:00+09:00"
        }
      ]
    }
  ],
  "approval_comment": "内容確認済み"
}
```

レスポンス:

```json
{
  "data": {
    "document": {
      "id": "uuid",
      "status": "approved",
      "approved_at": "2026-05-08T10:20:00+09:00"
    },
    "tasks": [
      {
        "id": "uuid",
        "title": "消防設備点検結果報告書を提出する",
        "status": "todo"
      }
    ]
  }
}
```

トランザクションで処理するもの:

- documents更新
- document_assets更新
- extracted_items採用状態更新
- document_approvals作成
- tasks作成
- reminders作成
- audit_logs作成
- notifications作成

### POST /documents/:documentId/reprocess

再解析する。

権限: owner / admin / member

リクエスト:

```json
{
  "document_type": "contract_renewal",
  "managed_asset_ids": ["uuid"],
  "counterparty_id": "uuid",
  "user_instruction": "契約更新期限と解約申出期限を重点的に確認してください。"
}
```

レスポンス:

```json
{
  "data": {
    "job_id": "uuid",
    "document_status": "processing"
  }
}
```

## 13. Tasks

### GET /tasks

クエリ:

```text
?status=todo&assignee_member_id=uuid&due_from=2026-06-01&due_to=2026-06-30&document_id=uuid&limit=50&cursor=...
```

レスポンス:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "消防設備点検結果報告書を提出する",
      "status": "todo",
      "priority": "high",
      "due_date": "2026-06-30",
      "assignee": {},
      "document": {
        "id": "uuid",
        "title": "消防設備点検結果報告書の提出依頼"
      }
    }
  ],
  "meta": {
    "next_cursor": null,
    "has_more": false
  }
}
```

### POST /tasks

手動タスク作成。

リクエスト:

```json
{
  "document_id": "uuid",
  "title": "自治体へ電話確認する",
  "description": "提出方法を確認する。",
  "assignee_member_id": "uuid",
  "due_date": "2026-06-10",
  "priority": "normal"
}
```

### GET /tasks/:taskId

### PATCH /tasks/:taskId

更新可能:

- title
- description
- assignee_member_id
- due_date
- priority
- status

### POST /tasks/:taskId/complete

完了処理。

リクエスト:

```json
{
  "comment": "提出完了。控えを台帳に保存済み。"
}
```

### POST /tasks/:taskId/comments

コメント追加。

リクエスト:

```json
{
  "body": "提出先に電話確認しました。郵送で問題ありません。"
}
```

## 14. Reminders / Notifications

### POST /tasks/:taskId/reminders

リマインド追加。

リクエスト:

```json
{
  "recipient_member_id": "uuid",
  "channel": "email",
  "remind_at": "2026-06-27T09:00:00+09:00"
}
```

### PATCH /reminders/:reminderId

更新可能:

- remind_at
- channel
- status

### GET /notifications

アプリ内通知一覧。

クエリ:

```text
?unread_only=true&limit=30&cursor=...
```

### PATCH /notifications/:notificationId/read

既読化。

## 15. Dashboard / Monthly Open Items

### GET /dashboard

ダッシュボード。

レスポンス:

```json
{
  "data": {
    "today_due_tasks": [],
    "week_due_tasks": [],
    "overdue_tasks": [],
    "needs_review_documents": [],
    "unassigned_tasks": [],
    "usage": {
      "included_count": 300,
      "purchased_extra_count": 30,
      "used_count": 128,
      "remaining_count": 202
    }
  }
}
```

### GET /monthly-open-items

月次未処理一覧。

クエリ:

```text
?month=2026-06
```

レスポンス:

```json
{
  "data": {
    "month": "2026-06",
    "documents": [
      {
        "id": "uuid",
        "title": "消防設備点検結果報告書の提出依頼",
        "status": "needs_review",
        "due_date": "2026-06-30",
        "review_url": "/documents/uuid/review"
      }
    ],
    "tasks": [
      {
        "id": "uuid",
        "title": "消防設備点検結果報告書を提出する",
        "status": "todo",
        "due_date": "2026-06-30",
        "task_url": "/tasks/uuid"
      }
    ],
    "summary": {
      "needs_review_count": 4,
      "overdue_task_count": 2,
      "unassigned_task_count": 3
    }
  }
}
```

## 16. Billing / Usage

### GET /billing/subscription

現在の契約。

権限: owner

レスポンス:

```json
{
  "data": {
    "plan_code": "business",
    "status": "active",
    "current_period_start": "2026-05-01T00:00:00+09:00",
    "current_period_end": "2026-06-01T00:00:00+09:00",
    "cancel_at_period_end": false
  }
}
```

### POST /billing/checkout

サブスクリプション契約・プラン変更用Checkoutを作成。

権限: owner

リクエスト:

```json
{
  "plan_code": "business",
  "success_url": "https://app.example.com/billing/success",
  "cancel_url": "https://app.example.com/billing"
}
```

レスポンス:

```json
{
  "data": {
    "checkout_url": "https://checkout.stripe.com/..."
  }
}
```

### POST /billing/extra-pack-checkout

追加パック購入。

権限: owner

リクエスト:

```json
{
  "pack_code": "extra_30",
  "success_url": "https://app.example.com/billing/success",
  "cancel_url": "https://app.example.com/billing"
}
```

pack_code:

- extra_10
- extra_30

### GET /billing/usage

使用件数。

レスポンス:

```json
{
  "data": {
    "period_start": "2026-05-01",
    "period_end": "2026-05-31",
    "included_count": 300,
    "purchased_extra_count": 30,
    "used_count": 128,
    "remaining_count": 202,
    "events": []
  }
}
```

### POST /stripe/webhook

Stripe Webhook。

認証:

- Stripe-Signature 検証必須

扱うイベント:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
- payment_intent.succeeded

## 17. Calendar

### POST /calendar/connect/google

Google Calendar OAuth開始。

後続でもよい。

### POST /tasks/:taskId/calendar-event

タスク期限をカレンダー登録する。

MVPでGoogle Calendar APIを後回しにする場合は、代替として以下を用意する。

```text
GET /tasks/:taskId/ics
```

## 18. Audit Logs

### GET /audit-logs

MVPではDB保存のみでもよい。Pro以降でUI公開。

権限: owner / admin

クエリ:

```text
?target_type=document&target_id=uuid&limit=50&cursor=...
```

## 19. 状態遷移

### document_status

```text
draft -> uploaded -> processing -> needs_review -> approved -> action_required -> completed
```

失敗:

```text
processing -> failed
failed -> processing
```

アーカイブ:

```text
approved/action_required/completed -> archived
```

### task_status

```text
todo -> in_progress -> waiting_review -> done
todo -> unnecessary
todo/in_progress -> canceled
```

## 20. バリデーション要点

### 書類登録

- title は最大200文字
- source_type は pdf / image / text / email_paste
- text_content は source_type が text / email_paste のとき必須
- file upload は source_type が pdf / image のとき必須

### 承認

ブロック:

- titleなし
- document_typeなし
- task_creations[].titleなし

警告して続行可能:

- due_dateなし
- assignee_member_idなし
- managed_asset_idsなし
- confidence低
- 期限が過去日

### 使用件数

- process開始時に上限チェック
- used_count + 1 > included_count + purchased_extra_count なら USAGE_LIMIT_EXCEEDED

## 21. セキュリティ要件

- すべてのIDは現在組織に属するか検証する
- R2のstorage_keyはAPIレスポンスに直接出さない
- 原本閲覧は短時間の署名付きURLを使う
- Stripe webhookは署名検証必須
- audit_logsは追記専用
- 削除は論理削除を基本にする
- AI処理用ログに個人情報を不用意に出さない

## 22. 次に実装で決めること

1. セッション管理方式
2. ファイルアップロードを署名付きURLにするかAPI経由にするか
3. 再解析の無料回数
4. 処理失敗時の使用件数返却ルール
5. Google Calendar連携をMVPに含めるか、.ics開始にするか
