import { normalizeMerchant } from '@/lib/normalize-merchant';
import type { CategoryRule } from '@/types/settings';
import { queryDB, executeDB, saveDB } from '@/lib/database';

/**
 * Match a normalized merchant name against a rule.
 * rule.merchantPattern takes priority; falls back to rule.keyword.
 */
export function matchMerchant(normalizedMerchant: string, rule: CategoryRule): boolean {
  const pattern = rule.merchantPattern ?? rule.keyword;
  if (!pattern) return false;
  return normalizedMerchant.includes(normalizeMerchant(pattern));
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
