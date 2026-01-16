
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function isCoprime(x: number, y: number): boolean {
  if (x === 0 && y === 0) return false;
  // In the context of this game, x=1 or y=1 are coprime with everything
  return gcd(x, y) === 1;
}

export interface RemappedPoint {
  x: number;
  y: number;
}

/**
 * Generates the specific non-linear transformation for "Cheat Mode"
 */
export function getRemappedPosition(x: number, y: number, gridSize: number): RemappedPoint {
  const sum = x + y;
  const newXRatio = (x === 0 && y === 0) ? 0 : x / sum;
  const newY = gcd(x, y);
  
  // Map back to grid space
  return {
    x: newXRatio * (gridSize - 1),
    y: newY
  };
}
