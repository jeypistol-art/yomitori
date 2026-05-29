import type { Metadata } from "next";
import LegalDocumentShell, {
  LegalSection,
} from "@/components/LegalDocumentShell";
import { getLegalConfig } from "@/lib/legal_config";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-[#e5e9df]">
      <th className="w-40 bg-[#fbfcf8] px-4 py-3 text-left align-top text-sm font-bold text-[#1f2933]">
        {label}
      </th>
      <td className="px-4 py-3 align-top text-sm leading-7 text-[#4b5563]">
        {children}
      </td>
    </tr>
  );
}

export default function SpecifiedCommercialTransactionsPage() {
  const legalConfig = getLegalConfig();

  return (
    <LegalDocumentShell
      title="特定商取引法に基づく表記"
      lead={`${legalConfig.serviceName}の有料プラン、追加パック、個別提供に関する表示です。`}
      lastUpdated={legalConfig.lastUpdated}
    >
      <LegalSection title="販売事業者情報">
        <div className="overflow-hidden border border-[#e5e9df]">
          <table className="w-full border-collapse">
            <tbody>
              <Row label="販売事業者">{legalConfig.businessName}</Row>
              <Row label="代表責任者">{legalConfig.representativeName}</Row>
              <Row label="所在地">{legalConfig.address}</Row>
              <Row label="電話番号">{legalConfig.phone}</Row>
              <Row label="問い合わせ先">
                <a
                  href={`mailto:${legalConfig.contactEmail}`}
                  className="font-semibold text-[#2f5d50] underline"
                >
                  {legalConfig.contactEmail}
                </a>
                <br />
                受付時間: {legalConfig.supportHours}
              </Row>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="販売価格">
        <div className="overflow-hidden border border-[#e5e9df]">
          <table className="w-full border-collapse">
            <tbody>
              {legalConfig.plans.map((plan) => (
                <Row key={plan.code} label={plan.name}>
                  {plan.priceLabel}
                  <br />
                  月次登録上限: {plan.includedDocuments}件
                </Row>
              ))}
              {legalConfig.extraPacks.map((pack) => (
                <Row key={pack.code} label={pack.name}>
                  {pack.priceLabel}
                  <br />
                  当月の登録枠を{pack.quantity}件追加
                </Row>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Enterpriseの個別設計、導入支援、API/Webhook連携などは、相談内容に応じて見積もりを提示します。
        </p>
      </LegalSection>

      <LegalSection title="商品代金以外の必要料金">
        <p>
          インターネット接続料金、通信料金、振込手数料その他利用者の環境に応じて発生する費用は利用者の負担となります。決済画面に税、手数料、割引等が表示される場合は、その表示に従います。
        </p>
      </LegalSection>

      <LegalSection title="支払方法・支払時期">
        <p>
          支払方法は、Stripeが提供するクレジットカードその他の決済手段です。サブスクリプション料金は申込時および更新時に請求されます。追加パックは購入時に請求されます。
        </p>
      </LegalSection>

      <LegalSection title="サービス提供時期">
        <p>
          決済完了後、利用者アカウントに対象プランまたは追加パックが反映され次第、利用できます。外部決済、認証、通信、審査、個別設定が必要な場合は、反映まで時間がかかることがあります。
        </p>
      </LegalSection>

      <LegalSection title="解約・キャンセル">
        <p>
          サブスクリプションは、利用状況・プラン画面またはStripeの決済管理画面から解約できます。解約予定を設定した場合、原則として現在の契約期間終了までは対象プランを利用できます。
        </p>
      </LegalSection>

      <LegalSection title="返品・返金">
        <p>
          本サービスはデジタルサービスの性質上、提供開始後の返品はできません。支払済みの利用料金は、法令上必要な場合または当社が個別に認める場合を除き、原則として返金しません。
        </p>
      </LegalSection>

      <LegalSection title="動作環境">
        <p>
          最新版の主要ブラウザでの利用を推奨します。PDF、画像、メール本文の登録、AI抽出、通知、決済などの一部機能は、ブラウザ、ネットワーク、外部サービスの状態により利用できない場合があります。
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
