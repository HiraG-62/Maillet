import { normalizeMerchant, fuzzyMatch } from '@/lib/normalize-merchant';
import type { CategoryRule } from '@/types/settings';
import { queryDB, executeDB, saveDB } from '@/lib/database';
import { updateTransactionCategory } from '@/lib/transactions';

/**
 * Match a normalized merchant name against a rule.
 * rule.merchantPattern takes priority; falls back to rule.keyword.
 */
export function matchMerchant(normalizedMerchant: string, rule: CategoryRule): boolean {
  const pattern = rule.merchantPattern ?? rule.keyword;
  if (!pattern) return false;
  const normalizedPattern = normalizeMerchant(pattern);
  // Primary: substring match (fast path)
  if (normalizedMerchant.includes(normalizedPattern)) return true;
  // Fallback: fuzzy match for typos/abbreviations (5+ char patterns only to avoid false positives)
  if (normalizedPattern.length >= 5) {
    return fuzzyMatch(normalizedMerchant, normalizedPattern);
  }
  return false;
}

/**
 * Try rules in order, return the category of the first match (or null).
 */
export function classifyByRules(
  merchantNormalized: string,
  rules: CategoryRule[],
): string | null {
  for (const rule of rules) {
    if (matchMerchant(merchantNormalized, rule)) {
      return rule.category;
    }
  }
  return null;
}

/**
 * Count of transactions with no category assigned.
 */
export async function getUnclassifiedCount(): Promise<number> {
  const rows = await queryDB<[number]>(
    "SELECT COUNT(*) FROM card_transactions WHERE category IS NULL OR category = ''",
    [],
  );
  return rows[0]?.[0] ?? 0;
}

/**
 * List unclassified merchants ordered by occurrence count (desc).
 */
export async function getUnclassifiedMerchants(
  limit = 30,
): Promise<Array<{ merchant: string; count: number }>> {
  const rows = await queryDB<[string, number]>(
    `SELECT merchant, COUNT(*) as cnt
     FROM card_transactions
     WHERE category IS NULL OR category = ''
     GROUP BY merchant
     ORDER BY cnt DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map(([merchant, count]) => ({ merchant, count }));
}

/**
 * Retroactively apply rules to all uncategorized transactions.
 * Already-categorized rows are left untouched (manual overrides protected).
 * Persists to IndexedDB via saveDB() when at least one row is updated.
 */
export async function retroactiveApply(
  rules: CategoryRule[],
): Promise<{ updated: number; skipped: number }> {
  const rows = await queryDB<[number, string]>(
    "SELECT id, merchant FROM card_transactions WHERE category IS NULL OR category = ''",
    [],
  );
  let updated = 0;
  let skipped = 0;
  for (const [id, merchant] of rows) {
    const normalized = normalizeMerchant(merchant ?? '');
    const category = classifyByRules(normalized, rules);
    if (category) {
      await executeDB(
        'UPDATE card_transactions SET category = ? WHERE id = ?',
        [category, id],
      );
      updated++;
    } else {
      skipped++;
    }
  }
  if (updated > 0) {
    await saveDB();
  }
  return { updated, skipped };
}

/**
 * Build classification rules from past manual category assignments.
 * For each merchant, picks the most frequently assigned category.
 * Returns rules with source: 'system' to distinguish from user-created rules.
 */
export async function buildLearnedRules(): Promise<CategoryRule[]> {
  const rows = await queryDB<[string, string]>(
    `SELECT merchant, category FROM card_transactions
     WHERE category IS NOT NULL AND category != ''
     AND (category_source = 'manual' OR category_source IS NULL)`,
    [],
  );

  // Group by merchant → count categories
  const merchantCats = new Map<string, Map<string, number>>();
  for (const [merchant, category] of rows) {
    if (!merchant) continue;
    const normalized = normalizeMerchant(merchant);
    if (!normalized) continue;
    let cats = merchantCats.get(normalized);
    if (!cats) {
      cats = new Map();
      merchantCats.set(normalized, cats);
    }
    cats.set(category, (cats.get(category) ?? 0) + 1);
  }

  // Pick top category per merchant
  const rules: CategoryRule[] = [];
  let idx = 0;
  for (const [merchant, cats] of merchantCats) {
    let topCat = '';
    let topCount = 0;
    for (const [cat, count] of cats) {
      if (count > topCount) {
        topCat = cat;
        topCount = count;
      }
    }
    if (topCat) {
      rules.push({
        id: `learned_${idx++}`,
        keyword: merchant,
        category: topCat,
        source: 'system',
      });
    }
  }

  return rules;
}

/**
 * Auto-classify uncategorized transactions using learned + settings rules.
 * Learned rules take priority (listed first).
 */
export async function autoClassifyNewTransactions(
  settingsRules: CategoryRule[],
): Promise<{ classified: number }> {
  const learnedRules = await buildLearnedRules();
  const combinedRules = [...learnedRules, ...settingsRules];

  const rows = await queryDB<[number, string]>(
    "SELECT id, merchant FROM card_transactions WHERE category IS NULL OR category = ''",
    [],
  );

  let classified = 0;
  for (const [id, merchant] of rows) {
    const normalized = normalizeMerchant(merchant ?? '');
    const category = classifyByRules(normalized, combinedRules);
    if (category) {
      await updateTransactionCategory(id, category, 'auto');
      classified++;
    }
  }

  if (classified > 0) {
    await saveDB();
  }

  return { classified };
}
