import { useState } from 'react';
import { FileText, Globe } from 'lucide-react';

type Lang = 'ja' | 'en';

export default function TermsOfServicePage() {
  const [lang, setLang] = useState<Lang>('ja');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 text-[var(--color-primary)]" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
            {lang === 'ja' ? '利用規約' : 'Terms of Service'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <button
            onClick={() => setLang('ja')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              lang === 'ja'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            日本語
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              lang === 'en'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {lang === 'ja' ? <JaTerms /> : <EnTerms />}
    </div>
  );
}

function JaTerms() {
  return (
    <div className="space-y-6 text-sm text-[var(--color-text-primary)]">
      <p className="text-[var(--color-text-secondary)]">最終更新日: 2026年3月4日</p>

      <Section title="第1条（適用範囲）">
        <p>
          本利用規約（以下「本規約」）は、Maillet（以下「本アプリ」）の利用に関する条件を定めるものです。
          本アプリを利用することにより、利用者は本規約に同意したものとみなします。
        </p>
      </Section>

      <Section title="第2条（サービスの概要）">
        <p>本アプリは以下の機能を提供します。</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Gmail からのクレジットカード利用明細の自動取得・解析</li>
          <li>取得したデータの閲覧・管理・集計</li>
          <li>外部 AI サービスを利用したカテゴリ分類支援</li>
        </ul>
        <p className="mt-2">
          <strong>重要:</strong> 本アプリはすべてのデータ処理をユーザーのブラウザ内でのみ行います。
          開発者はユーザーの個人情報・財務情報に一切アクセスできません。
        </p>
      </Section>

      <Section title="第3条（利用者の責任）">
        <ul className="list-disc pl-5 space-y-1">
          <li>利用者は、本アプリで使用する AI API キー（OpenAI、Anthropic、OpenRouter 等）を自己の責任で管理するものとします。</li>
          <li>利用者は、Google アカウントのセキュリティを自己の責任で維持するものとします。</li>
          <li>本アプリへのアクセスに使用するデバイス・ブラウザの管理は利用者の責任とします。</li>
        </ul>
      </Section>

      <Section title="第4条（免責事項）" highlight>
        <p className="font-semibold mb-2">⚠️ 財務情報の正確性に関する免責（最重要）</p>
        <p className="mb-3 p-3 rounded border border-[var(--color-primary)] bg-[var(--color-primary)]/10">
          本アプリが表示する支出データの正確性を保証しません。
          重要な財務判断には必ず公式の明細書・金融機関の情報を確認してください。
        </p>
        <p className="mb-2">開発者は、消費者契約法第8条の規定に基づき、故意または重大な過失による損害を除き、以下について責任を負いません。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>本アプリが表示するデータの誤り・欠落・遅延に起因する損害</li>
          <li>Google Gmail API の仕様変更・サービス停止に起因する機能不全</li>
          <li>外部 AI サービスの利用規約変更・API 廃止に伴う機能変更・停止</li>
          <li>ブラウザデータのクリア・デバイス変更等によるデータ損失</li>
          <li>利用者の API キー漏洩・不正利用による損害</li>
          <li>本アプリの利用によって生じた機会損失・逸失利益</li>
        </ul>
      </Section>

      <Section title="第5条（禁止事項）">
        <ul className="list-disc pl-5 space-y-1">
          <li>本アプリを違法な目的のために使用すること</li>
          <li>本アプリを通じた不正アクセス・クラッキング行為</li>
          <li>本アプリのリバースエンジニアリング・逆コンパイル・改ざん（オープンソースライセンス範囲を超えるもの）</li>
          <li>本アプリを利用した他者への嫌がらせ・詐欺行為</li>
        </ul>
      </Section>

      <Section title="第6条（知的財産権）">
        <p>
          本アプリのソースコードは MIT ライセンスのもとでオープンソースとして公開されています。
          ライセンスの全文は本アプリのリポジトリに掲載されている LICENSE ファイルを参照してください。
        </p>
      </Section>

      <Section title="第7条（サービスの変更・終了）">
        <p>
          開発者は、事前の通知なく本アプリの機能を変更・追加・削除、またはサービスを終了することがあります。
          利用者はこれに異議を申し立てることができないものとします。
        </p>
      </Section>

      <Section title="第8条（準拠法・管轄裁判所）">
        <p>
          本規約は日本法に準拠し、本アプリの利用に関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </Section>
    </div>
  );
}

function EnTerms() {
  return (
    <div className="space-y-6 text-sm text-[var(--color-text-primary)]">
      <p className="text-[var(--color-text-secondary)]">Last updated: March 4, 2026</p>

      <Section title="1. Scope of Application">
        <p>
          These Terms of Service ("Terms") govern your use of Maillet ("the App").
          By using the App, you agree to be bound by these Terms.
        </p>
      </Section>

      <Section title="2. Service Overview">
        <p>The App provides the following features:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Automatic retrieval and parsing of credit card statements from Gmail</li>
          <li>Viewing, managing, and summarizing retrieved financial data</li>
          <li>AI-assisted category classification using external AI services</li>
        </ul>
        <p className="mt-2">
          <strong>Important:</strong> All data processing occurs exclusively within your browser.
          Developers have absolutely no access to your personal or financial information.
        </p>
      </Section>

      <Section title="3. User Responsibilities">
        <ul className="list-disc pl-5 space-y-1">
          <li>You are solely responsible for managing the AI API keys (OpenAI, Anthropic, OpenRouter, etc.) used in the App.</li>
          <li>You are solely responsible for maintaining the security of your Google account.</li>
          <li>You are responsible for the security of the devices and browsers used to access the App.</li>
        </ul>
      </Section>

      <Section title="4. Disclaimer of Warranties" highlight>
        <p className="font-semibold mb-2">⚠️ Disclaimer Regarding Financial Data Accuracy (Critical)</p>
        <p className="mb-3 p-3 rounded border border-[var(--color-primary)] bg-[var(--color-primary)]/10">
          The accuracy of expenditure data displayed by this App is not guaranteed.
          For important financial decisions, always verify with official statements from your financial institution.
        </p>
        <p className="mb-2">
          To the fullest extent permitted by applicable law, and except in cases of willful misconduct or gross negligence,
          the developer shall not be liable for:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Any damages arising from errors, omissions, or delays in data displayed by the App</li>
          <li>Service disruption caused by changes to or discontinuation of the Google Gmail API</li>
          <li>Feature changes or discontinuation due to changes in external AI service terms or API deprecation</li>
          <li>Data loss resulting from browser data clearing, device changes, or similar events</li>
          <li>Damages from API key leakage or unauthorized use</li>
          <li>Lost profits or business opportunities arising from use of the App</li>
        </ul>
      </Section>

      <Section title="5. Prohibited Activities">
        <ul className="list-disc pl-5 space-y-1">
          <li>Using the App for any illegal purpose</li>
          <li>Unauthorized access or cracking activities through the App</li>
          <li>Reverse engineering, decompiling, or tampering with the App beyond what is permitted by the open source license</li>
          <li>Using the App to harass or defraud others</li>
        </ul>
      </Section>

      <Section title="6. Intellectual Property">
        <p>
          The source code of this App is published as open source under the MIT License.
          Please refer to the LICENSE file in the App's repository for the full text of the license.
        </p>
      </Section>

      <Section title="7. Changes and Termination of Service">
        <p>
          The developer reserves the right to modify, add, remove features, or terminate the App at any time without prior notice.
          Users may not object to such changes.
        </p>
      </Section>

      <Section title="8. Governing Law and Jurisdiction">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of Japan.
          Any disputes arising from the use of the App shall be subject to the exclusive jurisdiction of the Tokyo District Court as the court of first instance.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  highlight = false,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`float-card p-4 ${highlight ? 'border border-amber-500/30' : ''}`}>
      <h2 className="text-base font-semibold text-[var(--color-primary)] mb-3">{title}</h2>
      <div className="text-[var(--color-text-secondary)] leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
