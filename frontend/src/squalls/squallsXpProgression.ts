const LEVEL_TWO_XP_COST = 10;

function xpCostForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return LEVEL_TWO_XP_COST;
  const n = level - 2;
  return 10 + 12 * n + (n - 1) * n;
}

export function xpRequiredForLevel(level: number): number {
  const target = Math.max(1, Math.floor(level));
  if (target <= 1) return 0;
  let total = 0;
  for (let lvl = 2; lvl <= target; lvl++) {
    total += xpCostForLevel(lvl);
  }
  return total;
}

export function heroLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (safeXp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function xpToNextLevel(xp: number, level: number): {
  current: number;
  needed: number;
  remaining: number;
} {
  const safeLevel = Math.max(1, Math.floor(level));
  const currentThreshold = xpRequiredForLevel(safeLevel);
  const nextThreshold = xpRequiredForLevel(safeLevel + 1);
  const progress = Math.max(0, Math.floor(xp) - currentThreshold);
  const needed = Math.max(1, nextThreshold - currentThreshold);
  const clampedProgress = Math.min(progress, needed);
  return {
    current: clampedProgress,
    needed,
    remaining: Math.max(0, needed - clampedProgress),
  };
}
