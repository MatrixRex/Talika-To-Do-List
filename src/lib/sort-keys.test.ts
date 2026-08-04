import { describe, it, expect } from 'vitest';
import { generateKeyBetween } from './sort-keys';

describe('Fractional Indexing with Tiebreaker', () => {
  it('generates distinct keys for identical inputs (tiebreaker works)', () => {
    const key1 = generateKeyBetween(null, null);
    const key2 = generateKeyBetween(null, null);
    
    expect(key1).not.toBe(key2);
    
    // Both should start with the base key, which is the middle of the alphabet 'V' for (null, null)
    expect(key1.startsWith('V')).toBe(true);
    expect(key2.startsWith('V')).toBe(true);
  });

  it('generates a key strictly between two neighbours', () => {
    const a = generateKeyBetween(null, null);
    const c = generateKeyBetween(a, null);
    
    const b = generateKeyBetween(a, c);
    
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });
  
  it('handles 500 sequential inserts between the same two neighbours without collision', () => {
    const a = generateKeyBetween(null, null);
    const b = generateKeyBetween(a, null);
    
    const keys = new Set<string>();
    
    // Insert repeatedly between the same two boundaries, simulating concurrent inserts
    for (let i = 0; i < 500; i++) {
      const key = generateKeyBetween(a, b);
      keys.add(key);
      
      expect(a < key).toBe(true);
      expect(key < b).toBe(true);
    }
    
    // All 500 keys should be completely unique
    expect(keys.size).toBe(500);
  });
  
  it('handles 500 sequential inserts appending at the end without collision', () => {
    let current = generateKeyBetween(null, null);
    const keys = new Set<string>();
    keys.add(current);
    
    for (let i = 0; i < 500; i++) {
      current = generateKeyBetween(current, null);
      keys.add(current);
    }
    
    expect(keys.size).toBe(501);
  });
});
