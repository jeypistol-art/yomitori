import type { Metadata } from "next";
import LegalDocumentShell, {
  LegalList,
  LegalSection,
} from "@/components/LegalDocumentShell";
import { getLegalConfig } from "@/lib/legal_config";

export const metadata: Metadata = {
  title: "利用規約",
};

export default function TermsPage() {
  const legalConfig = getLegalConfig();

  return (
    <LegalDocumentShell
      title="利用規約"
      lead={`${legalConfig.serviceName}の利用条件を定めるものです。サービスを利用する前に内容をご確認ください。`}
      lastUpdated={legalConfig.lastUpdated}
    >
      <LegalSection title="1. 適用">
        <p>
          本規約は、{legalConfig.businessName}
          が提供する{legalConfig.serviceName}
          の利用に関する条件を定めます。利用者は、本サービスを利用することで本規約に同意したものとみなされます。
        </p>
      </LegalSection>

      <LegalSection title="2. サービス内容">
        <p>
          本サービスは、PDF、画像、メール本文などの書類情報から、要約、期限、対応事項、担当者候補、リマインド、証跡管理に役立つ情報を整理する業務支援サービスです。
        </p>
        <p>
          AIによる抽出結果は業務判断を補助する情報です。提出期限、法的義務、契約条件、金額、担当者、提出先などの最終確認は利用者の責任で行うものとします。
        </p>
      </LegalSection>

      <LegalSection title="3. アカウント管理">
        <LegalList
          items={[
            "利用者は、登録情報を正確かつ最新の状態に保つものとします。",
            "アカウント、認証情報、外部サービス連携情報の管理責任は利用者が負うものとします。",
            "不正利用、情報漏えい、第三者による利用が疑われる場合、利用者は速やかに当社へ連絡するものとします。",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 料金と支払い">
        <p>
          有料プラン、追加パック、Enterpriseの個別提供料金は、サービス画面または決済画面に表示します。支払いはStripeその他当社が指定する決済手段により行います。
        </p>
        <p>
          サブスクリプションは、利用者が解約手続きを行うまで契約期間ごとに自動更新されます。プラン変更、解約予定、支払い状態は利用状況・プラン画面または決済管理画面で確認できます。
        </p>
      </LegalSection>

      <LegalSection title="5. 禁止事項">
        <LegalList
          items={[
            "法令または公序良俗に反する利用",
            "第三者の権利、プライバシー、営業秘密を侵害する行為",
            "本サービスの運営、ネットワーク、システムに過度な負荷をかける行為",
            "リバースエンジニアリング、不正アクセス、脆弱性の悪用",
            "虚偽情報の登録、なりすまし、第三者アカウントの利用",
            "本サービスの出力を、人の確認を経ずに重要な法的・契約上の判断の唯一の根拠として扱う行為",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. データの取り扱い">
        <p>
          利用者が登録した書類、抽出結果、タスク、監査ログ、利用状況などのデータは、本サービスの提供、保守、セキュリティ確保、問い合わせ対応、品質改善のために取り扱います。
        </p>
        <p>
          個人情報の取り扱いは、別途定めるプライバシーポリシーに従います。
        </p>
      </LegalSection>

      <LegalSection title="7. サービスの変更・停止">
        <p>
          当社は、機能改善、保守、障害対応、法令対応、外部サービス仕様変更などの理由により、本サービスの全部または一部を変更、停止、中断することがあります。
        </p>
      </LegalSection>

      <LegalSection title="8. 免責">
        <p>
          当社は、本サービスが利用者の特定の目的に適合すること、AI抽出結果が常に完全かつ正確であること、障害や中断が発生しないことを保証しません。
        </p>
        <p>
          当社の責任が認められる場合でも、当社の賠償責任は、当該損害発生月に利用者が本サービスに支払った利用料金を上限とします。ただし、法令上制限できない責任を除きます。
        </p>
      </LegalSection>

      <LegalSection title="9. 規約の変更">
        <p>
          当社は、必要に応じて本規約を変更できます。重要な変更を行う場合は、サービス画面、メール、その他適切な方法で通知します。
        </p>
      </LegalSection>

      <LegalSection title="10. 準拠法・管轄">
        <p>
          本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、当社所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
