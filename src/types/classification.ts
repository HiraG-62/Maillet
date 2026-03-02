/**
 * AI提案の一時データ（永続化不要・セッション内のみ）
 */
export interface ClassificationProposal {
  merchantName: string;
  transactionCount: number;  // 未分類件数
  suggestedCategory: string;
  confidence: number;        // 0.0〜1.0
  reasoning: string;         // AI判断根拠（UI表示用）
}

/**
 * AutoRuleForge.generateCategoryProposals() の結果
 */
export interface ForgeResult {
  proposals: ClassificationProposal[];
  estimatedCost: string;      // 例: "~¥1未満"
  merchantCount: number;       // 送信した加盟店数
}
