import { describe, it, expect } from 'vitest';
import { generateUUID } from './uuid';

describe('generateUUID', () => {
  it('generates valid RFC4122 v4 UUID strings', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (let i = 0; i < 50; i++) {
      const id = generateUUID();
      expect(id).toMatch(uuidRegex);
    }
  });

  it('generates unique identifiers without collisions', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = generateUUID();
      expect(set.has(id)).toBe(false);
      set.add(id);
    }
  });

  it('works seamlessly in non-secure context when crypto.randomUUID is undefined', () => {
    const originalRandomUUID = crypto.randomUUID;
    try {
      delete (crypto as { randomUUID?: unknown }).randomUUID;

      const id = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    } finally {
      if (originalRandomUUID) {
        Object.defineProperty(crypto, 'randomUUID', {
          value: originalRandomUUID,
          configurable: true,
          writable: true,
        });
      }
    }
  });
});
