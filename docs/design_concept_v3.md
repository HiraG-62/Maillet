# Maillet Design Concept v3 — ANA Inspired

## コンセプトワード

**"Gentle Flow"** — メールから届くカード明細が、穏やかな流れのように整理されていく。
搭乗券が旅の記録であるように、カード明細は日々の生活の記録。

## ANAから学んだ原則のMaillet翻訳

### 1. 淡いグラデーション背景（空気感）
- ANAの「白→淡い水色」の背景をMailletのティールで翻訳
- ライト: `#ffffff → #f0fdfa → #ccfbf1`（白→極淡ティール）
- ダーク: `#042f2e → #063b38 → #0d4f48`（深緑→少し明るい深緑）
- フラット単色ではなく、180degの縦グラデーションで「空気感」を演出

### 2. 白い浮遊カード + 影
- ANAの搭乗券カードのように、白い紙が浮いている質感
- `border-radius: 16px` + `box-shadow` で浮遊感
- 上端に3pxのティールバー（ブランドアクセント）
- `backdrop-blur` は使わない（ガラスではなく紙の質感）

### 3. ブランドカラー1色（Teal）の濃淡統一
- brand-50 (#f0fdfa) 〜 brand-900 (#134e4a) の10段階スケール
- テキスト・アイコン・ボタン・バー全てをこのスケールから選択
- 旧デザインの多色使い（cyan+purple+orange）を廃止

### 4. CSS/SVGイラスト（世界観演出）
- 「封筒が開いてカードが飛び出す」シルエット
- フラットイラスト風（ライン+単色塗り）
- DashboardPage下部の余白に低opacity配置

### 5. 贅沢な余白 + 1画面1フォーカス
- px-6〜px-8 の余白
- max-w-2xl のコンテンツ幅制限
- セクション間 mb-8〜mb-10 の大きな余白

### 6. ピル型ボトムナビ
- アクティブタブに丸背景(pill)でアイコン+ラベルを表示
- 非アクティブはアイコンのみ（ラベル非表示）

## カラーシステム

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| background | #f8fffe | ページ背景（グラデーション起点） |
| surface | #ffffff | カード背景 |
| primary | #0d9488 | ブランドカラー（brand-600） |
| primary-light | #ccfbf1 | アクティブ背景・ピル背景 |
| text-primary | #134e4a | メインテキスト（brand-900） |
| text-secondary | #0f766e | サブテキスト（brand-700） |
| text-muted | #64748b | 補助テキスト |

### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| background | #042f2e | ページ背景 |
| surface | #0a3d38 | カード背景 |
| primary | #2dd4bf | ブランドカラー（brand-400） |
| primary-light | #134e4a | アクティブ背景 |
| text-primary | #f0fdfa | メインテキスト（brand-50） |
| text-secondary | #99f6e4 | サブテキスト（brand-200） |
| text-muted | #5eead4 | 補助テキスト（brand-300） |

## イラスト設計

### メインイラスト（DashboardPage）
- SVGインライン: 封筒(rect+path) + カード(rect+chip) が飛び出す構図
- 装飾ドット: ランダム配置の小さな円で空気感を演出
- opacity: ライトモード 0.5、ダークモード 0.3
- 高さ: 140px、幅: 100%

## 新規CSSクラス

| Class | Purpose |
|-------|---------|
| `.gradient-bg` | グラデーション背景（min-height: 100vh） |
| `.float-card` | 浮遊カード（白背景+影+上端バー） |
| `.float-card-flat` | ボーダーなし浮遊カード |
| `.nav-pill-active` | ピル型ナビアクティブ状態 |
| `.service-icon` / `.service-icon-circle` / `.service-icon-label` | 丸型サービスアイコン |
| `.maillet-illustration` | イラストコンテナ |
| `.fade-in` / `.slide-up` | アニメーション |
