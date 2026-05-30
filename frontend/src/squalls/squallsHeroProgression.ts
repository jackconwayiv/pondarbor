export function maxHpForLevel(level: number): number {
  return 15 + 5 * Math.max(1, Math.floor(level));
}
