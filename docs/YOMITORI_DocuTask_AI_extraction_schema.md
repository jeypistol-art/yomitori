# YOMITORI DocuTask AI抽出JSONスキーマ

## 1. 目的

AI抽出JSONスキーマは、OCR済みテキストや貼り付け本文から、書類台帳・承認画面・タスク作成に必要な情報を構造化して返すための仕様。

このスキーマで実現すること:

- 書類種別を判定する
- 要約と重要事項を生成する
- 期限・提出物・必要対応を抽出する
- タスク候補を作る
- リマインド候補を作る
- 根拠箇所を保存する
- 承認画面の右ペインにそのまま流し込める形式にする

## 2. 基本方針

### AIの出力は候補

AIの出力は正式データではない。承認画面で人間が確認・修正・承認した内容だけを正式な台帳・タスクに反映する。

### 根拠を必ず持つ

重要項目には source_refs を付ける。

対象:

- 期限
- 提出物
- 必要対応
- 金額
- 契約期間
- 解約申出期限
- 注意点
- リスク
- 問い合わせ先

### confidenceを持つ

抽出項目ごとに confidence を持たせる。

目安:

- 0.90以上: 高信頼
- 0.70以上: 通常
- 0.50以上: 要確認
- 0.50未満: 低信頼

## 3. 入力前提

AIに渡す入力は以下を想定する。

```json
{
  "schema_version": "1.0",
  "organization_context": {
    "industry": "property_or_facility_management",
    "timezone": "Asia/Tokyo"
  },
  "document_context": {
    "source_type": "pdf",
    "user_selected_document_type": null,
    "user_selected_asset_names": [],
    "user_selected_counterparty_name": null
  },
  "pages": [
    {
      "page_number": 1,
      "ocr_text": "..."
    }
  ]
}
```

### 入力補助情報

ユーザーが書類種別、管理対象、取引先を事前選択している場合、AIはそれを優先する。

ただし、本文と矛盾する場合は warnings に記録する。

## 4. 出力トップレベル

```json
{
  "schema_version": "1.0",
  "extraction_id": null,
  "language": "ja",
  "document_classification": {},
  "document_summary": {},
  "parties": {},
  "managed_asset_candidates": [],
  "important_dates": [],
  "required_actions": [],
  "required_documents": [],
  "amounts": [],
  "contract_terms": {},
  "risks_and_notes": [],
  "contact_points": [],
  "task_candidates": [],
  "reminder_candidates": [],
  "reply_draft": null,
  "storage_suggestion": {},
  "warnings": [],
  "missing_information": [],
  "quality": {},
  "raw_notes": []
}
```

## 5. Enum定義

### document_type

```text
municipal_notice
contract_renewal
lease_renewal
insurance_renewal
tenant_contract_renewal
legal_change_notice
inspection_report
other
unknown
```

### date_type

```text
notice_date
document_date
response_deadline
application_deadline
submission_deadline
renewal_deadline
cancellation_deadline
payment_deadline
inspection_date
effective_date
contract_start_date
contract_end_date
other
```

### action_type

```text
submit
apply
confirm
reply
pay
renew
cancel
schedule
inspect
share_internal
contact_counterparty
archive_only
other
```

### priority

```text
low
normal
high
urgent
```

### confidence_level

```text
high
medium
low
```

## 6. 共通オブジェクト

### source_ref

原本上の根拠箇所。

```json
{
  "page_number": 1,
  "source_text": "提出期限は令和8年6月30日までです。",
  "bounding_box": {
    "x": 0.12,
    "y": 0.35,
    "width": 0.42,
    "height": 0.04
  }
}
```

### bounding_box

座標はページ内の相対値 0.0 から 1.0 で表す。

OCRやPDF側で座標が取れない場合は null でよい。

### confidence

```json
{
  "score": 0.87,
  "level": "high",
  "reason": "期限を示す明確な文言があるため"
}
```

## 7. document_classification

書類種別判定。

```json
{
  "document_type": "municipal_notice",
  "document_type_label": "行政・自治体通知",
  "subtype": "消防設備点検に関する通知",
  "confidence": {
    "score": 0.91,
    "level": "high",
    "reason": "自治体名、通知日、提出期限、届出書類の記載があるため"
  },
  "alternative_types": [
    {
      "document_type": "legal_change_notice",
      "document_type_label": "法改正に伴う提出物案内",
      "confidence_score": 0.42
    }
  ],
  "needs_human_review": false
}
```

## 8. document_summary

要約。

```json
{
  "title_candidate": "消防設備点検結果報告書の提出依頼",
  "one_line_summary": "管理施設の消防設備点検結果を期限までに提出する必要があります。",
  "short_summary": [
    "自治体から消防設備点検結果報告書の提出を求める通知です。",
    "対象施設の点検結果を指定期限までに提出する必要があります。",
    "未提出の場合、確認連絡や追加対応が発生する可能性があります。"
  ],
  "detailed_summary": "この書類は、管理対象施設に関する消防設備点検結果報告書の提出を求める通知です。提出期限、提出先、問い合わせ先が記載されており、期限内に担当者を決めて対応する必要があります。",
  "key_points": [
    {
      "text": "消防設備点検結果報告書の提出が必要",
      "source_refs": [],
      "confidence": {
        "score": 0.88,
        "level": "high",
        "reason": "提出を求める明確な記載があるため"
      }
    }
  ]
}
```

## 9. parties

発行元、契約相手、提出先。

```json
{
  "issuer": {
    "name": "〇〇市 建築安全課",
    "type": "municipality",
    "source_refs": [],
    "confidence": {
      "score": 0.92,
      "level": "high",
      "reason": "文書ヘッダーに発行元として記載されているため"
    }
  },
  "counterparty": {
    "name": null,
    "type": null,
    "source_refs": [],
    "confidence": {
      "score": 0.0,
      "level": "low",
      "reason": "契約相手に該当する記載がないため"
    }
  },
  "submit_to": {
    "name": "〇〇市 建築安全課",
    "method": "郵送または窓口提出",
    "source_refs": [],
    "confidence": {
      "score": 0.84,
      "level": "high",
      "reason": "提出先と提出方法の記載があるため"
    }
  }
}
```

## 10. managed_asset_candidates

管理対象候補。

```json
[
  {
    "name": "〇〇ビル",
    "asset_type": "facility",
    "address": "東京都〇〇区...",
    "matched_existing_asset_id": null,
    "source_refs": [],
    "confidence": {
      "score": 0.76,
      "level": "medium",
      "reason": "対象施設名として記載されているため"
    }
  }
]
```

## 11. important_dates

重要日付。

```json
[
  {
    "date_type": "submission_deadline",
    "label": "提出期限",
    "date": "2026-06-30",
    "time": null,
    "timezone": "Asia/Tokyo",
    "description": "消防設備点検結果報告書の提出期限",
    "is_primary_due_date": true,
    "source_refs": [
      {
        "page_number": 1,
        "source_text": "提出期限 令和8年6月30日",
        "bounding_box": null
      }
    ],
    "confidence": {
      "score": 0.9,
      "level": "high",
      "reason": "提出期限として明記されているため"
    }
  }
]
```

### 日付変換ルール

和暦は西暦に変換する。

例:

- 令和8年6月30日 -> 2026-06-30
- 令和8年3月末日 -> 2026-03-31

変換に迷う場合は date を null にし、raw_date_text に原文を入れる。

```json
{
  "date_type": "submission_deadline",
  "label": "提出期限",
  "date": null,
  "raw_date_text": "令和8年6月末日頃",
  "needs_human_review": true
}
```

## 12. required_actions

必要対応。

```json
[
  {
    "action_type": "submit",
    "title": "消防設備点検結果報告書を提出する",
    "description": "対象施設の点検結果報告書を提出期限までに自治体へ提出する。",
    "due_date": "2026-06-30",
    "related_date_index": 0,
    "suggested_assignee_role": "施設管理担当",
    "priority": "high",
    "source_refs": [],
    "confidence": {
      "score": 0.87,
      "level": "high",
      "reason": "提出対象と期限が明記されているため"
    }
  }
]
```

## 13. required_documents

提出物。

```json
[
  {
    "name": "消防設備点検結果報告書",
    "description": "対象施設の消防設備点検結果を記載した報告書",
    "submit_to": "〇〇市 建築安全課",
    "submission_method": "郵送または窓口提出",
    "due_date": "2026-06-30",
    "source_refs": [],
    "confidence": {
      "score": 0.86,
      "level": "high",
      "reason": "提出書類名と提出期限が記載されているため"
    }
  }
]
```

## 14. amounts

金額。

```json
[
  {
    "label": "更新後月額リース料",
    "amount": 88000,
    "currency": "JPY",
    "tax_included": true,
    "description": "更新後の月額リース料金",
    "source_refs": [],
    "confidence": {
      "score": 0.82,
      "level": "high",
      "reason": "金額と月額表記があるため"
    }
  }
]
```

金額がない書類では空配列にする。

## 15. contract_terms

契約更新系書類で使う。

```json
{
  "contract_name": "複合機リース契約",
  "current_period": {
    "start_date": "2021-07-01",
    "end_date": "2026-06-30",
    "raw_text": "契約期間 令和3年7月1日から令和8年6月30日まで"
  },
  "renewal_period": {
    "start_date": "2026-07-01",
    "end_date": "2031-06-30",
    "raw_text": "更新後契約期間 令和8年7月1日から令和13年6月30日まで"
  },
  "renewal_deadline": "2026-05-31",
  "cancellation_deadline": "2026-05-15",
  "auto_renewal": true,
  "condition_changes": [
    {
      "label": "月額料金変更",
      "before": "82,500円",
      "after": "88,000円",
      "impact": "月額5,500円の増額",
      "source_refs": []
    }
  ],
  "source_refs": [],
  "confidence": {
    "score": 0.78,
    "level": "medium",
    "reason": "契約期間と更新条件は読み取れるが、一部条件変更の範囲は確認が必要"
  }
}
```

行政通知など契約情報がない書類では null または空オブジェクトにする。

## 16. risks_and_notes

注意点・リスク。

```json
[
  {
    "type": "deadline_risk",
    "severity": "high",
    "title": "提出期限を過ぎる可能性があります",
    "description": "提出期限が近いため、担当者を設定して早めに対応する必要があります。",
    "recommended_action": "提出期限の7日前と3日前にリマインドを設定する",
    "source_refs": [],
    "confidence": {
      "score": 0.81,
      "level": "high",
      "reason": "期限が明記されており、対応タスクが必要なため"
    }
  }
]
```

severity:

- low
- medium
- high
- urgent

## 17. contact_points

問い合わせ先。

```json
[
  {
    "name": "〇〇市 建築安全課",
    "person": "山田",
    "phone": "03-0000-0000",
    "email": "kenchiku@example.jp",
    "address": "東京都〇〇区...",
    "available_hours": "平日 9:00-17:00",
    "source_refs": [],
    "confidence": {
      "score": 0.88,
      "level": "high",
      "reason": "問い合わせ先欄に記載されているため"
    }
  }
]
```

## 18. task_candidates

承認画面でタスク候補として表示する。

```json
[
  {
    "temp_id": "task_1",
    "title": "消防設備点検結果報告書を提出する",
    "description": "対象施設の消防設備点検結果報告書を自治体へ提出する。",
    "action_type": "submit",
    "priority": "high",
    "due_date": "2026-06-30",
    "suggested_assignee_role": "施設管理担当",
    "suggested_assignee_member_id": null,
    "related_required_action_index": 0,
    "related_required_document_indexes": [0],
    "create_by_default": true,
    "source_refs": [],
    "confidence": {
      "score": 0.87,
      "level": "high",
      "reason": "提出物と期限が明確なため"
    }
  }
]
```

### タスク化ルール

原則として以下は task_candidates にする。

- 期限がある対応
- 提出物がある対応
- 担当者確認が必要な対応
- 契約更新判断
- 解約申出期限の確認
- 金額変更の確認

以下はタスク化しない場合がある。

- 単なるお知らせ
- 対応不要と明記されている書類
- 保管のみでよい書類

ただし archive_only の候補として表示してよい。

## 19. reminder_candidates

リマインド候補。

```json
[
  {
    "temp_id": "reminder_1",
    "related_task_temp_id": "task_1",
    "remind_at": "2026-06-23T09:00:00+09:00",
    "channel": "in_app",
    "label": "期限7日前",
    "create_by_default": true,
    "reason": "提出期限の7日前に確認するため"
  },
  {
    "temp_id": "reminder_2",
    "related_task_temp_id": "task_1",
    "remind_at": "2026-06-27T09:00:00+09:00",
    "channel": "email",
    "label": "期限3日前",
    "create_by_default": true,
    "reason": "提出漏れ防止のため"
  }
]
```

### 初期候補ルール

- 期限7日前
- 期限3日前
- 期限前日
- 期限当日

期限が近い場合:

- 7日前を過ぎている場合は3日前・前日・当日
- 3日前を過ぎている場合は前日・当日
- 当日または過去日の場合は即時確認タスク

## 20. reply_draft

返信文案。

```json
{
  "needed": true,
  "subject": "消防設備点検結果報告書の提出について",
  "body": "〇〇市 建築安全課 ご担当者様\n\nお世話になっております。\n消防設備点検結果報告書につきまして、期限までに提出いたします。\nどうぞよろしくお願いいたします。",
  "tone": "business_formal",
  "source_refs": [],
  "confidence": {
    "score": 0.7,
    "level": "medium",
    "reason": "提出対応が必要な書類のため、返信文案を生成"
  }
}
```

不要な場合:

```json
{
  "needed": false,
  "subject": null,
  "body": null,
  "tone": null,
  "source_refs": [],
  "confidence": {
    "score": 0.75,
    "level": "medium",
    "reason": "返信を求める記載がないため"
  }
}
```

## 21. storage_suggestion

保管名・タグ。

```json
{
  "title_candidate": "2026-06-30_消防設備点検結果報告書_〇〇ビル_〇〇市",
  "tags": [
    "行政通知",
    "消防設備",
    "提出期限あり",
    "〇〇ビル"
  ],
  "folder_hint": "行政通知/消防設備/2026",
  "retention_note": "提出完了後も点検記録として保管推奨"
}
```

## 22. warnings

承認画面で要確認アラートとして表示する。

```json
[
  {
    "code": "MULTIPLE_DEADLINES_FOUND",
    "severity": "medium",
    "message": "期限候補が複数あります。主期限を確認してください。",
    "related_paths": [
      "$.important_dates[0]",
      "$.important_dates[1]"
    ]
  }
]
```

### warning code候補

```text
LOW_CONFIDENCE_DUE_DATE
NO_PRIMARY_DUE_DATE
MULTIPLE_DEADLINES_FOUND
PAST_DUE_DATE
ASSIGNEE_NOT_DETERMINED
MANAGED_ASSET_NOT_FOUND
COUNTERPARTY_NOT_FOUND
CONTRACT_RENEWAL_WITH_CANCELLATION_DEADLINE
AMOUNT_CHANGE_DETECTED
OCR_QUALITY_LOW
DOCUMENT_TYPE_UNCERTAIN
REQUIRES_HUMAN_CONFIRMATION
```

## 23. missing_information

不足情報。

```json
[
  {
    "field": "managed_asset",
    "label": "管理対象",
    "reason": "対象施設名を明確に特定できませんでした。",
    "required_for_approval": false
  },
  {
    "field": "assignee",
    "label": "担当者",
    "reason": "担当者候補は文書内に記載されていません。",
    "required_for_approval": false
  }
]
```

## 24. quality

抽出品質。

```json
{
  "overall_confidence": {
    "score": 0.84,
    "level": "high",
    "reason": "主要な期限、提出物、発行元を抽出できているため"
  },
  "ocr_quality": {
    "score": 0.78,
    "level": "medium",
    "issues": [
      "一部の表部分が読み取りにくい可能性があります"
    ]
  },
  "needs_human_review": true,
  "human_review_reasons": [
    "期限候補が複数あるため",
    "管理対象の特定が必要なため"
  ]
}
```

## 25. raw_notes

AIが判断に迷った点。ユーザー向けにそのまま出すのではなく、開発・デバッグ・承認補助に使う。

```json
[
  "対象施設名は本文中に明記されているが、既存管理対象との照合は未実施。",
  "提出期限と確認期限の2種類の日付があるため、主期限の確認が必要。"
]
```

## 26. 完整な出力例: 行政・自治体通知

```json
{
  "schema_version": "1.0",
  "extraction_id": null,
  "language": "ja",
  "document_classification": {
    "document_type": "municipal_notice",
    "document_type_label": "行政・自治体通知",
    "subtype": "消防設備点検に関する通知",
    "confidence": {
      "score": 0.91,
      "level": "high",
      "reason": "自治体名、通知日、提出期限、届出書類の記載があるため"
    },
    "alternative_types": [],
    "needs_human_review": false
  },
  "document_summary": {
    "title_candidate": "消防設備点検結果報告書の提出依頼",
    "one_line_summary": "管理施設の消防設備点検結果を期限までに提出する必要があります。",
    "short_summary": [
      "自治体から消防設備点検結果報告書の提出を求める通知です。",
      "対象施設の点検結果を指定期限までに提出する必要があります。",
      "未提出の場合、確認連絡や追加対応が発生する可能性があります。"
    ],
    "detailed_summary": "この書類は、管理対象施設に関する消防設備点検結果報告書の提出を求める通知です。",
    "key_points": [
      {
        "text": "消防設備点検結果報告書の提出が必要",
        "source_refs": [
          {
            "page_number": 1,
            "source_text": "消防設備点検結果報告書を提出してください。",
            "bounding_box": null
          }
        ],
        "confidence": {
          "score": 0.88,
          "level": "high",
          "reason": "提出を求める明確な記載があるため"
        }
      }
    ]
  },
  "parties": {
    "issuer": {
      "name": "〇〇市 建築安全課",
      "type": "municipality",
      "source_refs": [],
      "confidence": {
        "score": 0.92,
        "level": "high",
        "reason": "文書ヘッダーに発行元として記載されているため"
      }
    },
    "counterparty": {
      "name": null,
      "type": null,
      "source_refs": [],
      "confidence": {
        "score": 0.0,
        "level": "low",
        "reason": "契約相手に該当する記載がないため"
      }
    },
    "submit_to": {
      "name": "〇〇市 建築安全課",
      "method": "郵送または窓口提出",
      "source_refs": [],
      "confidence": {
        "score": 0.84,
        "level": "high",
        "reason": "提出先と提出方法の記載があるため"
      }
    }
  },
  "managed_asset_candidates": [
    {
      "name": "〇〇ビル",
      "asset_type": "facility",
      "address": null,
      "matched_existing_asset_id": null,
      "source_refs": [],
      "confidence": {
        "score": 0.76,
        "level": "medium",
        "reason": "対象施設名として記載されているため"
      }
    }
  ],
  "important_dates": [
    {
      "date_type": "submission_deadline",
      "label": "提出期限",
      "date": "2026-06-30",
      "time": null,
      "timezone": "Asia/Tokyo",
      "description": "消防設備点検結果報告書の提出期限",
      "is_primary_due_date": true,
      "source_refs": [
        {
          "page_number": 1,
          "source_text": "提出期限 令和8年6月30日",
          "bounding_box": null
        }
      ],
      "confidence": {
        "score": 0.9,
        "level": "high",
        "reason": "提出期限として明記されているため"
      }
    }
  ],
  "required_actions": [
    {
      "action_type": "submit",
      "title": "消防設備点検結果報告書を提出する",
      "description": "対象施設の点検結果報告書を提出期限までに自治体へ提出する。",
      "due_date": "2026-06-30",
      "related_date_index": 0,
      "suggested_assignee_role": "施設管理担当",
      "priority": "high",
      "source_refs": [],
      "confidence": {
        "score": 0.87,
        "level": "high",
        "reason": "提出対象と期限が明記されているため"
      }
    }
  ],
  "required_documents": [
    {
      "name": "消防設備点検結果報告書",
      "description": "対象施設の消防設備点検結果を記載した報告書",
      "submit_to": "〇〇市 建築安全課",
      "submission_method": "郵送または窓口提出",
      "due_date": "2026-06-30",
      "source_refs": [],
      "confidence": {
        "score": 0.86,
        "level": "high",
        "reason": "提出書類名と提出期限が記載されているため"
      }
    }
  ],
  "amounts": [],
  "contract_terms": {},
  "risks_and_notes": [
    {
      "type": "deadline_risk",
      "severity": "high",
      "title": "提出期限があります",
      "description": "期限までに報告書を提出する必要があります。",
      "recommended_action": "担当者を設定し、期限7日前と3日前にリマインドを設定する",
      "source_refs": [],
      "confidence": {
        "score": 0.81,
        "level": "high",
        "reason": "提出期限と提出物が明記されているため"
      }
    }
  ],
  "contact_points": [
    {
      "name": "〇〇市 建築安全課",
      "person": null,
      "phone": "03-0000-0000",
      "email": null,
      "address": null,
      "available_hours": null,
      "source_refs": [],
      "confidence": {
        "score": 0.8,
        "level": "high",
        "reason": "問い合わせ先欄に記載されているため"
      }
    }
  ],
  "task_candidates": [
    {
      "temp_id": "task_1",
      "title": "消防設備点検結果報告書を提出する",
      "description": "対象施設の消防設備点検結果報告書を自治体へ提出する。",
      "action_type": "submit",
      "priority": "high",
      "due_date": "2026-06-30",
      "suggested_assignee_role": "施設管理担当",
      "suggested_assignee_member_id": null,
      "related_required_action_index": 0,
      "related_required_document_indexes": [0],
      "create_by_default": true,
      "source_refs": [],
      "confidence": {
        "score": 0.87,
        "level": "high",
        "reason": "提出物と期限が明確なため"
      }
    }
  ],
  "reminder_candidates": [
    {
      "temp_id": "reminder_1",
      "related_task_temp_id": "task_1",
      "remind_at": "2026-06-23T09:00:00+09:00",
      "channel": "in_app",
      "label": "期限7日前",
      "create_by_default": true,
      "reason": "提出期限の7日前に確認するため"
    },
    {
      "temp_id": "reminder_2",
      "related_task_temp_id": "task_1",
      "remind_at": "2026-06-27T09:00:00+09:00",
      "channel": "email",
      "label": "期限3日前",
      "create_by_default": true,
      "reason": "提出漏れ防止のため"
    }
  ],
  "reply_draft": {
    "needed": false,
    "subject": null,
    "body": null,
    "tone": null,
    "source_refs": [],
    "confidence": {
      "score": 0.75,
      "level": "medium",
      "reason": "返信を求める記載がないため"
    }
  },
  "storage_suggestion": {
    "title_candidate": "2026-06-30_消防設備点検結果報告書_〇〇ビル_〇〇市",
    "tags": ["行政通知", "消防設備", "提出期限あり", "〇〇ビル"],
    "folder_hint": "行政通知/消防設備/2026",
    "retention_note": "提出完了後も点検記録として保管推奨"
  },
  "warnings": [],
  "missing_information": [
    {
      "field": "assignee",
      "label": "担当者",
      "reason": "担当者候補は文書内に記載されていません。",
      "required_for_approval": false
    }
  ],
  "quality": {
    "overall_confidence": {
      "score": 0.84,
      "level": "high",
      "reason": "主要な期限、提出物、発行元を抽出できているため"
    },
    "ocr_quality": {
      "score": 0.78,
      "level": "medium",
      "issues": []
    },
    "needs_human_review": true,
    "human_review_reasons": [
      "担当者の設定が必要なため"
    ]
  },
  "raw_notes": []
}
```

## 27. JSON Schema案

実装時は、まず以下のような緩めのJSON Schemaから始める。運用しながら document_type ごとの専用スキーマへ分ける。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://yomitori.example/schema/ai-extraction-v1.json",
  "title": "YOMITORI DocuTask AI Extraction",
  "type": "object",
  "required": [
    "schema_version",
    "language",
    "document_classification",
    "document_summary",
    "important_dates",
    "required_actions",
    "required_documents",
    "task_candidates",
    "reminder_candidates",
    "warnings",
    "missing_information",
    "quality"
  ],
  "properties": {
    "schema_version": {
      "type": "string",
      "const": "1.0"
    },
    "extraction_id": {
      "type": ["string", "null"]
    },
    "language": {
      "type": "string"
    },
    "document_classification": {
      "type": "object"
    },
    "document_summary": {
      "type": "object"
    },
    "parties": {
      "type": "object"
    },
    "managed_asset_candidates": {
      "type": "array"
    },
    "important_dates": {
      "type": "array"
    },
    "required_actions": {
      "type": "array"
    },
    "required_documents": {
      "type": "array"
    },
    "amounts": {
      "type": "array"
    },
    "contract_terms": {
      "type": "object"
    },
    "risks_and_notes": {
      "type": "array"
    },
    "contact_points": {
      "type": "array"
    },
    "task_candidates": {
      "type": "array"
    },
    "reminder_candidates": {
      "type": "array"
    },
    "reply_draft": {
      "type": ["object", "null"]
    },
    "storage_suggestion": {
      "type": "object"
    },
    "warnings": {
      "type": "array"
    },
    "missing_information": {
      "type": "array"
    },
    "quality": {
      "type": "object"
    },
    "raw_notes": {
      "type": "array"
    }
  },
  "additionalProperties": false
}
```

## 28. DBへの保存マッピング

### ai_extractions

保存するもの:

- schema_version
- model
- prompt_version
- raw_output
- normalized_output
- overall_confidence

### extracted_items

配列から個別保存するもの:

- important_dates
- required_actions
- required_documents
- amounts
- risks_and_notes
- contact_points
- task_candidates

### documents

承認後に保存するもの:

- title
- suggested_title
- document_type
- document_date
- due_date
- summary
- key_points
- required_actions
- required_documents
- risks
- approved_at
- approved_by_member_id

### tasks

承認後に task_candidates から作成する。

### reminders

承認後に reminder_candidates から作成する。

## 29. プロンプト実装メモ

AIへの指示では、以下を強く指定する。

- 出力はJSONのみ
- schema_versionは必ず1.0
- 不明な値は推測で埋めず null にする
- 和暦は可能な限り西暦ISO形式に変換する
- 期限が複数ある場合はすべて important_dates に入れる
- 主期限候補は is_primary_due_date を true にする
- 根拠文を source_refs に入れる
- 重要項目には confidence を入れる
- 判断に迷う点は warnings に入れる
- 法的判断や税務判断を断定しない
- ユーザーが行うべき確認・提出・返信・更新判断を task_candidates にする

## 30. バリデーションルール

AI出力受信後にアプリ側で検証する。

### ブロック

- JSONとしてパースできない
- schema_versionが違う
- document_classificationがない
- document_summaryがない
- task_candidatesが配列でない
- important_datesが配列でない

### 警告

- confidenceが低い重要項目がある
- source_refsがない重要項目がある
- due_dateが過去
- reminder_candidatesの日付が過去
- task_candidatesにdue_dateがない
- required_documentsがあるのにtask_candidatesがない

## 31. バージョニング

初期は schema_version 1.0 とする。

変更方針:

- 破壊的変更は 2.0
- 項目追加は 1.1
- document_type 専用スキーマ追加は 1.x

ai_extractions には schema_version と prompt_version を必ず保存する。

## 32. 次に決めること

1. document_typeごとの専用プロンプトを分けるか
2. Google Calendar登録用の日時ルール
3. 和暦・曖昧日付の扱い
4. 低confidence項目を承認画面でどう強調するか
5. source_refsのbounding_boxをMVPで必須にするか
