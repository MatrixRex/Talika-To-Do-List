const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function getChar(char: string): number {
  return ALPHABET.indexOf(char);
}

function midChar(c1: string, c2: string): string | null {
  const i1 = getChar(c1);
  const i2 = getChar(c2);
  const mid = Math.floor((i1 + i2) / 2);
  if (mid === i1 || mid === i2) return null;
  return ALPHABET.charAt(mid);
}

export function generateKeyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) {
    throw new Error(`a (${a}) must be less than b (${b})`);
  }

  // Base key generation
  let baseKey = '';
  
  if (a === null && b === null) {
    baseKey = ALPHABET.charAt(Math.floor(ALPHABET.length / 2));
  } else if (a === null) {
    // Before b
    let i = 0;
    while (true) {
      const bChar = i < b!.length ? b!.charAt(i) : ALPHABET.charAt(ALPHABET.length - 1);
      const m = midChar(ALPHABET.charAt(0), bChar);
      if (m !== null) {
        baseKey += m;
        break;
      }
      baseKey += ALPHABET.charAt(0);
      i++;
    }
  } else if (b === null) {
    // After a
    let i = 0;
    while (true) {
      const aChar = i < a.length ? a.charAt(i) : ALPHABET.charAt(0);
      const m = midChar(aChar, ALPHABET.charAt(ALPHABET.length - 1));
      if (m !== null) {
        baseKey += m;
        break;
      }
      baseKey += aChar;
      i++;
    }
  } else {
    // Between a and b
    let i = 0;
    while (true) {
      const aChar = i < a.length ? a.charAt(i) : ALPHABET.charAt(0);
      const bChar = i < b.length ? b.charAt(i) : ALPHABET.charAt(ALPHABET.length - 1);
      
      if (aChar === bChar) {
        baseKey += aChar;
        i++;
        continue;
      }
      
      const m = midChar(aChar, bChar);
      if (m !== null) {
        baseKey += m;
        break;
      }
      
      // They are adjacent. We append aChar, and then we need to go to the next character of 'a'
      // and find something between it and the end of the alphabet.
      baseKey += aChar;
      
      let j = i + 1;
      while (true) {
        const nextA = j < a.length ? a.charAt(j) : ALPHABET.charAt(0);
        const nextM = midChar(nextA, ALPHABET.charAt(ALPHABET.length - 1));
        if (nextM !== null) {
          baseKey += nextM;
          break;
        }
        baseKey += nextA;
        j++;
      }
      break;
    }
  }

  // Append a tiebreaker suffix to ensure distinct keys even for concurrent inserts
  let tiebreaker = '';
  for (let i = 0; i < 5; i++) {
    tiebreaker += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  
  return baseKey + tiebreaker;
}
