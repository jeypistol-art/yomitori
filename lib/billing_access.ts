import { ApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";

export type BillingOperation = "document_processing" | "extra_pack_purchase";

export type BillingAccess = {
  allowed: boolean;
  status: string;
  label: string;
  severity: "ok" | "warning" | "blocked";
  message: string;
};

type SubscriptionStatusRow = {
  status: string | null;
  stripe_subscription_id: string | null;
};

const okStatuses = new Set(["active", "trialing"]);

const statusLabels: Record<string, string> = {
  active: "有効",
  trialing: "トライアル",
  past_due: "支払い確認中",
  incomplete: "未完了",
  incomplete_expired: "未完了期限切れ",
  unpaid: "未払い",
  canceled: "解約済み",
  paused: "停止中",
  not_started: "未契約",
};

const operationLabels: Record<BillingOperation, string> = {
  document_processing: "新規書類登録・AI解析",
  extra_pack_purchase: "追加パック購入",
};

function getBlockedMessage(status: string, operation: BillingOperation) {
  const operationLabel = operationLabels[operation];
  if (status === "past_due") {
    return `支払い確認が必要なため、${operationLabel}を一時停止しています。Stripeの請求・支払い管理から支払い方法を確認してください。`;
  }
  if (status === "incomplete") {
    return `初回支払いが完了していないため、${operationLabel}を一時停止しています。Stripeの請求・支払い管理から支払いを完了してください。`;
  }
  if (status === "unpaid") {
    return `未払い状態のため、${operationLabel}を停止しています。Stripeの請求・支払い管理から支払いを確認してください。`;
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return `サブスクリプションが有効ではないため、${operationLabel}を停止しています。利用再開にはプランを再契約してください。`;
  }
  if (status === "paused") {
    return `サブスクリプションが停止中のため、${operationLabel}を停止しています。Stripeの請求・支払い管理を確認してください。`;
  }
  return `請求状態の確認が必要なため、${operationLabel}を一時停止しています。Stripeの請求・支払い管理を確認してください。`;
}

export async function getBillingAccess(
  organizationId: string,
  operation: BillingOperation
): Promise<BillingAccess> {
  const result = await query<SubscriptionStatusRow>(
    `SELECT status, stripe_subscription_id
     FROM subscriptions
     WHERE organization_id = $1
     ORDER BY
       CASE
         WHEN status IN ('active', 'trialing', 'past_due', 'incomplete') THEN 0
         ELSE 1
       END,
       updated_at DESC,
       created_at DESC
     LIMIT 1`,
    [organizationId]
  );
  const subscription = result.rows[0];
  if (!subscription?.stripe_subscription_id) {
    if (operation === "extra_pack_purchase") {
      return {
        allowed: false,
        status: "not_started",
        label: statusLabels.not_started,
        severity: "warning",
        message: "追加パック購入には有効な月額プランが必要です。先にPersonal以上のプランを契約してください。",
      };
    }

    return {
      allowed: true,
      status: "not_started",
      label: statusLabels.not_started,
      severity: "ok",
      message: "Stripeサブスクリプションはまだ作成されていません。",
    };
  }

  const status = subscription.status ?? "unknown";
  if (okStatuses.has(status)) {
    return {
      allowed: true,
      status,
      label: statusLabels[status] ?? status,
      severity: "ok",
      message: "請求状態は正常です。",
    };
  }

  return {
    allowed: false,
    status,
    label: statusLabels[status] ?? status,
    severity:
      status === "past_due" || status === "incomplete" ? "warning" : "blocked",
    message: getBlockedMessage(status, operation),
  };
}

export async function requireBillingAccess(
  organizationId: string,
  operation: BillingOperation
) {
  const access = await getBillingAccess(organizationId, operation);
  if (!access.allowed) {
    throw new ApiError(402, access.message);
  }
  return access;
}
