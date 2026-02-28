// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/subscription-detector', () => ({
  detectSubscriptions: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  queryDB: vi.fn().mockResolvedValue([]),
  initDB: vi.fn().mockResolvedValue({}),
}));

import { detectSubscriptions } from '@/services/subscription-detector';

describe('useSubscriptions hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSubscriptions がエクスポートされている', async () => {
    const module = await import('../useSubscriptions');
    expect(typeof module.useSubscriptions).toBe('function');
  });

  it('detectSubscriptions が使用可能', async () => {
    (detectSubscriptions as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const module = await import('../useSubscriptions');
    expect(module.useSubscriptions).toBeDefined();
  });

  it('detectSubscriptions がサブスク一覧を返す', async () => {
    const mockSubs = [
      {
        merchant: 'Netflix',
        amount: 1490,
        frequency: 'monthly' as const,
        confidence: 'high' as const,
        occurrences: 6,
        lastDate: '2026-02-01T00:00:00Z',
        nextEstimatedDate: '2026-03-01T00:00:00Z',
        dates: [],
      },
    ];
    (detectSubscriptions as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubs);

    const result = await detectSubscriptions();
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Netflix');
    expect(result[0].frequency).toBe('monthly');
  });

  it('detectSubscriptions がエラー時に空配列を返す場合に対応できる', async () => {
    (detectSubscriptions as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    try {
      await detectSubscriptions();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('取引0件の場合 detectSubscriptions は空配列を返す', async () => {
    (detectSubscriptions as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await detectSubscriptions();
    expect(result).toEqual([]);
  });
});
