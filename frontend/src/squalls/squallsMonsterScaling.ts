import type { MonsterTemplate } from "./monsters";

export type ScaledMonsterStats = {
  hp: number;
  armor: number;
  damageMin: number;
  damageMax: number;
};

export function scaleMonsterStats(
  template: MonsterTemplate,
  level: number,
): ScaledMonsterStats {
  const targetLevel = Math.max(1, Math.floor(level));
  const levelOffset = targetLevel - 1;
  return {
    hp: Math.max(1, template.hp + 2 * levelOffset),
    armor: Math.max(0, template.armor ?? 0),
    damageMin: 1 + 2 * levelOffset,
    damageMax: 4 + 2 * levelOffset,
  };
}
