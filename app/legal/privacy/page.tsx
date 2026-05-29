import type { Metadata } from "next";
import LegalDocumentShell, {
  LegalList,
  LegalSection,
} from "@/components/LegalDocumentShell";
import { getLegalConfig } from "@/lib/legal_config";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
};

export default function PrivacyPage() {
  const legalConfig = getLegalConfig();

  return (
    <LegalDocumentShell
      title="プライバシーポリシー"
      lead={`${legalConfig.businessName}は、${legalConfig.serviceName}の提供にあたり、利用者情報を適切に取り扱います。`}
      lastUpdated={legalConfig.lastUpdated}
    >
      <LegalSection title="1. 取得する情報">
        <LegalList
          items={[
            "氏名、メールアドレス、会社名、組織名、担当者情報などのアカウント情報",
            "ログイン、認証、権限、セッションに関する情報",
            "登録された書類、画像、PDF、メール本文、抽出結果、タスク、リマインド、監査ログ",
            "プラン、利用量、決済状態、請求管理に必要な情報",
            "問い合わせ、導入相談、サポート対応の内容",
            "IPアドレス、ブラウザ、端末、アクセス日時、操作ログ、エラーログなどの技術情報",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. 利用目的">
        <LegalList
          items={[
            "本サービスの提供、本人確認、認証、組織管理、権限管理のため",
            "書類の要約、期限抽出、タスク化、リマインド、監査ログ表示のため",
            "利用量管理、料金請求、決済、プラン変更、追加パック購入のため",
            "問い合わせ対応、導入相談、サポート、障害対応のため",
            "サービスの安全性確保、不正利用防止、ログ調査、品質改善のため",
            "法令、規約、契約に基づく対応のため",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 外部サービス・委託先">
        <p>
          本サービスでは、提供に必要な範囲で外部サービスを利用します。決済情報、認証情報、書類データ、メール送信情報などは、各サービスの役割に応じて処理されます。
        </p>
        <LegalList
          items={[
            "Stripe: 決済、請求、サブスクリプション管理",
            "Google: OAuthログイン、導入相談フォームの回答管理",
            "Cloudflare Workers / R2: アプリケーション配信、ファイル保管、セキュリティ",
            "Neon: データベース",
            "OpenAI: 書類内容の抽出、要約、タスク候補生成",
            "Resendまたはメール送信基盤: リマインド、通知、サポート連絡",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 第三者提供">
        <p>
          当社は、法令に基づく場合、利用者の同意がある場合、サービス提供に必要な委託先へ提供する場合を除き、個人情報を第三者へ提供しません。
        </p>
      </LegalSection>

      <LegalSection title="5. 安全管理">
        <p>
          当社は、アクセス制御、認証、通信の暗号化、権限管理、監査ログ、委託先管理など、利用者情報を保護するために必要かつ適切な安全管理措置を講じます。
        </p>
      </LegalSection>

      <LegalSection title="6. データ保持と削除">
        <p>
          利用者データは、サービス提供、契約管理、法令対応、監査、問い合わせ対応に必要な期間保持します。解約後のデータ保持期間や削除条件は、サービス仕様、契約条件、法令上の義務に従います。
        </p>
      </LegalSection>

      <LegalSection title="7. 開示・訂正・削除等の請求">
        <p>
          利用者は、当社が保有する自己の個人情報について、法令に基づき開示、訂正、利用停止、削除等を請求できます。請求は以下の連絡先までご連絡ください。
        </p>
        <p>
          連絡先:{" "}
          <a
            href={`mailto:${legalConfig.contactEmail}`}
            className="font-semibold text-[#2f5d50] underline"
          >
            {legalConfig.contactEmail}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="8. Cookie等の利用">
        <p>
          本サービスでは、ログイン状態の維持、セキュリティ、利用状況の把握、品質改善のため、Cookieまたは類似技術を利用することがあります。
        </p>
      </LegalSection>

      <LegalSection title="9. 改定">
        <p>
          当社は、必要に応じて本ポリシーを改定します。重要な変更がある場合は、サービス画面、メール、その他適切な方法で通知します。
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
