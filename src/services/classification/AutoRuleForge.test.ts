// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { estimateCost, clearSessionKey } from './AutoRuleForge';

describe('AutoRuleForge', () => {
  describe('estimateCost', () => {
    it('30加盟店 → ~¥1未満', () => {
      expect(estimateCost(30)).toBe('~¥1未満');
    });

    it('0加盟店 → ~¥1未満', () => {
      expect(estimateCost(0)).toBe('~¥1未満');
    });

    it('大量加盟店で¥1以上', () => {
      // 30000加盟店 = 3M tokens * $0.25/M = $0.75 * 150 = ¥112.5 → ~¥113
      const result = estimateCost(30000);
      expect(result).toMatch(/^~¥\d+$/);
    });
  });

  describe('clearSessionKey', () => {
    it('should not throw', () => {
      expect(() => clearSessionKey()).not.toThrow();
    });
  });
});
