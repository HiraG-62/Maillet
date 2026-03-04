import { useState } from 'react';
import { Shield } from 'lucide-react';

type Lang = 'ja' | 'en';

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="float-card p-5 mb-4">
      <h2 className="text-base font-semibold text-[var(--color-primary)] mb-3">{title}</h2>
      <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

function JaContent() {
  return (
    <>
      <SectionBlock title="1. 運営者情報">
        <p>本アプリ「Maillet」（以下「本サービス」）は個人により開発・運営されています。</p>
        <p>お問い合わせ先については第8条をご参照ください。</p>
      </SectionBlock>

      <SectionBlock title="2. 収集する情報">
        <p>本サービスが収集・処理する情報は以下のとおりです：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Gmailの利用通知メール：</span>
            カード利用通知メールの件名・本文をお客様のブラウザ内でのみ処理します。メール内容を外部サーバーへ送信することはありません。
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">支出データ：</span>
            解析した支出情報はお客様のデバイスのIndexedDB（ブラウザストレージ）にのみ保存されます。開発者はこのデータにアクセスできません。
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">APIキー：</span>
            入力されたAPIキーはAES-256暗号化によりブラウザ内にのみ保存されます。外部サーバーへの送信・開発者によるアクセスは一切ありません。
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Google OAuthトークン：</span>
            Gmail APIアクセスのためのOAuthトークンはPKCEフローによりブラウザ内でのみ取り扱われます。
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock title="3. 情報の利用目的">
        <p>収集した情報は以下の目的のみに使用します：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>カード利用明細の自動解析・表示</li>
          <li>支出データの集計・カテゴリ分類</li>
          <li>AI機能（BYOK）によるスマート分類</li>
          <li>アプリの機能提供に必要な処理</li>
        </ul>
        <p>マーケティング目的での利用、第三者への販売は行いません。</p>
      </SectionBlock>

      <SectionBlock title="4. 第三者への情報提供">
        <p>原則として、お客様の情報を第三者に提供しません。ただし、以下の場合を除きます：</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">AI API（BYOK）：</span>
            スマート分類機能を使用する場合、お客様が設定したAPIキーを使用して取引情報をAIプロバイダー（OpenAI、Anthropic、Google等）に送信します。送信内容はお客様が管理するAPIキーに紐づき、各プロバイダーのプライバシーポリシーが適用されます。
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Google Gemini無料枠の注意：</span>
            Google Geminiの無料枠（APIキーなし）を使用する場合、Googleがモデル改善目的でデータを使用する可能性があります。機密情報を含む取引データには有料プランまたは他のプロバイダーの使用を推奨します。
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">GitHub Pages CDN：</span>
            本サービスはGitHub Pagesによりホスティングされており、アプリファイルの配信にGitHubのCDNを使用します。GitHubのプライバシーポリシー（<a href="https://docs.github.com/ja/site-policy/privacy-policies/github-general-privacy-statement" className="text-[var(--color-primary)] underline" target="_blank" rel="noopener noreferrer">GitHub Privacy Statement</a>）が適用されます。
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock title="5. Google APIサービス利用に関する宣言">
        <p>
          本サービスのGoogle APIサービスから取得した情報の利用は、
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-[var(--color-primary)] underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>
          （Limited Use要件を含む）に準拠します。
        </p>
        <p className="mt-2 p-3 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] italic text-xs">
          "Maillet's use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements."
        </p>
        <p className="mt-2">具体的には：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gmailデータはカード利用明細の解析目的のみに使用します</li>
          <li>GmailデータをAI/MLモデルの学習に使用しません</li>
          <li>Gmailデータをお客様の明示的な同意なく第三者に販売・共有しません</li>
          <li>GmailデータはGoogleの定めるサービスのポリシーに従って処理します</li>
        </ul>
      </SectionBlock>

      <SectionBlock title="6. データの保管・削除方法">
        <p>すべてのデータはお客様のデバイスのブラウザストレージ（IndexedDB）に保存されます。</p>
        <p>データの削除方法：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>ブラウザの「サイトデータを削除」機能からIndexedDBをクリアすることで全データを削除できます</li>
          <li>設定画面のエクスポート機能でデータをバックアップしてから削除することを推奨します</li>
          <li>Google OAuthの連携解除はGoogleアカウントの「アプリへのアクセス」設定から行えます</li>
        </ul>
        <p>開発者によるデータの保管・バックアップは一切行っていません。</p>
      </SectionBlock>

      <SectionBlock title="7. セキュリティ対策">
        <ul className="list-disc pl-5 space-y-1">
          <li>APIキーはAES-256暗号化によりブラウザに保存</li>
          <li>Google OAuthはPKCE（Proof Key for Code Exchange）フローを採用</li>
          <li>外部サーバーへのデータ送信なし（Gmail処理はすべてブラウザ内）</li>
          <li>GitHub Pages + HTTPS による安全なコンテンツ配信</li>
        </ul>
      </SectionBlock>

      <SectionBlock title="8. お問い合わせ">
        <p>本プライバシーポリシーに関するご質問は、GitHubのIssueよりお問い合わせください。</p>
        <p>
          <a href="https://github.com/HiraG-62/Maillet/issues" className="text-[var(--color-primary)] underline" target="_blank" rel="noopener noreferrer">
            https://github.com/HiraG-62/Maillet/issues
          </a>
        </p>
      </SectionBlock>

      <SectionBlock title="9. 準拠法・管轄裁判所">
        <p>本プライバシーポリシーは日本法に準拠します。</p>
        <p>本サービスに関する紛争については、日本の裁判所を専属的合意管轄裁判所とします。</p>
      </SectionBlock>

      <SectionBlock title="10. 改定">
        <p>本ポリシーは必要に応じて改定することがあります。重要な変更は本ページにて告知します。</p>
        <p className="mt-2 font-medium text-[var(--color-text-primary)]">最終更新日：2026年3月4日</p>
      </SectionBlock>
    </>
  );
}

function EnContent() {
  return (
    <>
      <SectionBlock title="1. Operator Information">
        <p>Maillet (the "Service") is developed and operated by an individual developer.</p>
        <p>For contact information, please refer to Section 8.</p>
      </SectionBlock>

      <SectionBlock title="2. Information We Collect">
        <p>The Service collects and processes the following information:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Gmail notification emails:</span>
            {' '}Card usage notification emails (subject and body) are processed exclusively within your browser. Email content is never transmitted to external servers.
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Spending data:</span>
            {' '}Parsed spending information is stored only in your device's IndexedDB (browser storage). The developer cannot access this data.
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">API keys:</span>
            {' '}API keys you provide are encrypted with AES-256 and stored only in your browser. They are never transmitted to external servers or accessed by the developer.
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Google OAuth tokens:</span>
            {' '}OAuth tokens for Gmail API access are handled exclusively within your browser via the PKCE flow.
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock title="3. How We Use Your Information">
        <p>Collected information is used solely for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Automatic parsing and display of card transaction records</li>
          <li>Aggregation and categorization of spending data</li>
          <li>AI-powered smart classification (BYOK)</li>
          <li>Processing necessary for app functionality</li>
        </ul>
        <p>We do not use your information for marketing purposes or sell it to third parties.</p>
      </SectionBlock>

      <SectionBlock title="4. Sharing with Third Parties">
        <p>We do not share your information with third parties, except in the following cases:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">AI APIs (BYOK):</span>
            {' '}When using the smart classification feature, transaction information is sent to AI providers (OpenAI, Anthropic, Google, etc.) using the API key you configured. The data is associated with your API key, and each provider's privacy policy applies.
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">Note on Google Gemini free tier:</span>
            {' '}When using Google Gemini's free tier (without API key), Google may use data for model improvement purposes. We recommend using a paid plan or alternative providers for transaction data containing sensitive information.
          </li>
          <li>
            <span className="text-[var(--color-text-primary)] font-medium">GitHub Pages CDN:</span>
            {' '}The Service is hosted on GitHub Pages and uses GitHub's CDN to deliver app files. GitHub's{' '}
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" className="text-[var(--color-primary)] underline" target="_blank" rel="noopener noreferrer">Privacy Statement</a>
            {' '}applies.
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock title="5. Google API Services User Data Policy">
        <p>
          Maillet's use of information received from Google APIs will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-[var(--color-primary)] underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>
          , including the Limited Use requirements.
        </p>
        <p className="mt-2 p-3 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] italic text-xs">
          "Maillet's use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements."
        </p>
        <p className="mt-2">Specifically:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gmail data is used only for the purpose of parsing card transaction records</li>
          <li>Gmail data is not used to train AI/ML models</li>
          <li>Gmail data is not sold or shared with third parties without your explicit consent</li>
          <li>Gmail data is processed in accordance with Google's terms of service</li>
        </ul>
      </SectionBlock>

      <SectionBlock title="6. Data Storage and Deletion">
        <p>All data is stored in your device's browser storage (IndexedDB).</p>
        <p>To delete your data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Clear the IndexedDB through your browser's "Clear site data" feature to delete all data</li>
          <li>We recommend exporting your data via the Settings page before deleting</li>
          <li>To revoke Google OAuth access, visit Google Account settings under "Third-party apps &amp; services"</li>
        </ul>
        <p>The developer does not store or backup any of your data.</p>
      </SectionBlock>

      <SectionBlock title="7. Security Measures">
        <ul className="list-disc pl-5 space-y-1">
          <li>API keys are stored in browser with AES-256 encryption</li>
          <li>Google OAuth uses PKCE (Proof Key for Code Exchange) flow</li>
          <li>No data transmission to external servers (Gmail processing is entirely in-browser)</li>
          <li>Secure content delivery via GitHub Pages + HTTPS</li>
        </ul>
      </SectionBlock>

      <SectionBlock title="8. Contact">
        <p>For questions regarding this Privacy Policy, please contact us via GitHub Issues:</p>
        <p>
          <a href="https://github.com/HiraG-62/Maillet/issues" className="text-[var(--color-primary)] underline" target="_blank" rel="noopener noreferrer">
            https://github.com/HiraG-62/Maillet/issues
          </a>
        </p>
      </SectionBlock>

      <SectionBlock title="9. Governing Law and Jurisdiction">
        <p>This Privacy Policy is governed by the laws of Japan.</p>
        <p>Any disputes related to the Service shall be subject to the exclusive jurisdiction of the courts of Japan.</p>
      </SectionBlock>

      <SectionBlock title="10. Changes to This Policy">
        <p>We may update this Policy as necessary. Significant changes will be announced on this page.</p>
        <p className="mt-2 font-medium text-[var(--color-text-primary)]">Last updated: March 4, 2026</p>
      </SectionBlock>
    </>
  );
}

export default function PrivacyPolicyPage() {
  const [lang, setLang] = useState<Lang>('ja');

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-[var(--color-primary)]" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
            {lang === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}
          </h1>
        </div>
        <div className="flex gap-1 bg-[var(--color-surface-elevated)] rounded-lg p-1">
          <button
            onClick={() => setLang('ja')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              lang === 'ja'
                ? 'bg-[var(--color-primary)] text-white font-medium'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            日本語
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              lang === 'en'
                ? 'bg-[var(--color-primary)] text-white font-medium'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {lang === 'ja' ? <JaContent /> : <EnContent />}
    </div>
  );
}
