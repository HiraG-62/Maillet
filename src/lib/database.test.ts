// @vitest-environment node
import { describe, it, expect } from 'vitest';

describe('database module exports', () => {
  it('exports initDB, queryDB, executeDB, saveDB', async () => {
    const mod = await import('./database');
    expect(typeof mod.initDB).toBe('function');
    expect(typeof mod.queryDB).toBe('function');
    expect(typeof mod.executeDB).toBe('function');
    expect(typeof mod.saveDB).toBe('function');
  });
});
