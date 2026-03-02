import { loadKey } from '@/services/llm/key-store';
import { getUnclassifiedMerchants } from '@/services/classification/CategoryRuleEngine';
import { normalizeMerchant } from '@/lib/normalize-merchant';
import { useSettingsStore } from '@/stores/settings-store';
import type { LLMProvider } from '@/types/llm';
import type { ClassificationProposal, ForgeResult } from '@/types/classification';
import { CATEGORIES } from '@/services/category';

// セッション内APIキャッシュ（PIN入力を1セッション1回に限定）
let _sessionKey: { provider: LLMProvider; key: string } | null = null;

/**
 * セッション内キャッシュを使ってAPIキーを取得
 * キャッシュがなければ PIN を要求する（呼び出し元が pin を渡す）
 */
export async function getApiKey(pin: string): Promise<{ provider: LLMProvider; key: string }> {
  if (_sessionKey) return _sessionKey;

  const provider = useSettingsStore.getState().llm_provider;
  if (!provider) throw new Error('LLMプロバイダーが設定されていません。設定からAPIキーを登録してください。');

  const key = await loadKey(provider, pin);
  if (!key) throw new Error(`${provider} のAPIキーが見つかりません。設定からAPIキーを登録してください。`);

  _sessionKey = { provider, key };
  return _sessionKey;
}

/** セッションキャッシュをクリア（テスト用・ログアウト用） */
export function clearSessionKey(): void {
  _sessionKey = null;
}

/**
 * 推定コストを文字列で返す（表示専用・概算）
 * 30加盟店 × ~100トークン ≈ 3000トークン = $0.003 ≈ ¥0.5
 */
export function estimateCost(merchantCount: number): string {
  // Haiku/GPT-4o-mini レベルの概算
  const tokensPerMerchant = 100;
  const totalTokens = merchantCount * tokensPerMerchant;
  const usdCost = (totalTokens / 1_000_000) * 0.25; // $0.25/M tokens (概算)
  const jpyCost = usdCost * 150;
  if (jpyCost < 1) return '~¥1未満';
  return `~¥${Math.ceil(jpyCost)}`;
}

/**
 * LLM API呼び出し（プロバイダーに応じてエンドポイント切り替え）
 */
async function callLLM(
  provider: LLMProvider,
  apiKey: string,
  prompt: string
): Promise<string> {
  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status}`);
    const data = await resp.json() as { content: Array<{type: string; text: string}> };
    return data.content[0]?.text ?? '';

  } else if (provider === 'openai' || provider === 'openrouter') {
    const baseUrl = provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1';
    const model = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    const data = await resp.json() as { choices: Array<{message: {content: string}}> };
    return data.choices[0]?.message?.content ?? '';

  } else {
    // google: 簡易実装（不完全でもよい）
    throw new Error('Google プロバイダーは現在 SmartClassify 未対応です。');
  }
}

/**
 * プロンプト生成（日本語加盟店名対応）
 */
function buildPrompt(
  merchants: Array<{ merchant: string; count: number }>
): string {
  const categoryList = Object.keys(CATEGORIES).join('、');
  const merchantLines = merchants
    .map((m, i) => `${i + 1}. "${m.merchant}" (${m.count}件)`)
    .join('\n');

  return `あなたはクレジットカード明細のカテゴリ分類アシスタントです。
以下の加盟店名リストを、指定カテゴリに分類してください。

【カテゴリ一覧】
${categoryList}

【分類対象の加盟店名（件数付き）】
${merchantLines}

【出力形式】必ずJSON配列で返してください。
[
  {
    "merchantName": "加盟店名そのまま",
    "suggestedCategory": "カテゴリ名",
    "confidence": 0.9,
    "reasoning": "判断理由（1文）"
  },
  ...
]

注意事項:
- 日本語の加盟店名（半角カナ、略称、英語混じり）に対応してください
- confidence は 0.0〜1.0 で判断の確信度を示してください
- どのカテゴリにも当てはまらない場合は suggestedCategory を "" にしてください
- JSON 以外のテキストは出力しないでください`;
}

/**
 * メインAPI: 未分類加盟店にAIカテゴリ提案を生成
 * @param pin ユーザーPIN（APIキー復号用）
 * @param limit 対象加盟店数（デフォルト30）
 * @throws オフライン時・APIエラー・PINエラー時
 */
export async function generateCategoryProposals(
  pin: string,
  limit = 30
): Promise<ForgeResult> {
  // 1. オフラインチェック
  if (!navigator.onLine) {
    throw new Error('オフライン中です。ネットワーク接続を確認してください。');
  }

  // 2. APIキー取得（PIN解除）
  const { provider, key } = await getApiKey(pin);

  // 3. 未分類加盟店取得
  const merchants = await getUnclassifiedMerchants(limit);
  if (merchants.length === 0) {
    return { proposals: [], estimatedCost: '¥0', merchantCount: 0 };
  }

  // 4. プロンプト生成 & API呼び出し
  const prompt = buildPrompt(merchants);
  let rawText: string;
  try {
    rawText = await callLLM(provider, key, prompt);
  } catch (err) {
    // APIエラー時はセッションキャッシュをクリアしない（PINは正しい）
    throw new Error(`AI APIエラー: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. JSONパース（失敗時はフォールバック）
  let parsed: ClassificationProposal[];
  try {
    // JSON部分を抽出（マークダウンコードブロック対応）
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON配列が見つかりません');
    const raw = JSON.parse(match[0]) as Array<{
      merchantName: string;
      suggestedCategory: string;
      confidence: number;
      reasoning: string;
    }>;
    // merchantName を元のリストと照合してtransactionCountを付与
    const countMap = new Map(merchants.map(m => [normalizeMerchant(m.merchant), m.count]));
    parsed = raw
      .filter(r => r.suggestedCategory) // カテゴリなし除外
      .map(r => ({
        merchantName: r.merchantName,
        transactionCount: countMap.get(normalizeMerchant(r.merchantName)) ?? 1,
        suggestedCategory: r.suggestedCategory,
        confidence: Math.max(0, Math.min(1, r.confidence)),
        reasoning: r.reasoning ?? '',
      }))
      .sort((a, b) => b.confidence - a.confidence); // 確信度降順
  } catch {
    throw new Error('AI応答の解析に失敗しました。再試行してください。');
  }

  return {
    proposals: parsed,
    estimatedCost: estimateCost(merchants.length),
    merchantCount: merchants.length,
  };
}
