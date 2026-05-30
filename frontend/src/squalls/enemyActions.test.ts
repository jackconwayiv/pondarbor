import { describe, expect, it } from "vitest";

import {
  formatEnemyBroadcastLine,
  formatEnemyIntentRollRange,
} from "./enemyActions";
import { spawnEnemy } from "./combatRules";

function testEnemy(
  overrides: Partial<Parameters<typeof spawnEnemy>[0]> & {
    broadcast?: "attack" | "defend" | "buff" | "debuff";
    level?: number;
    damageMin?: number;
    damageMax?: number;
  } = {},
) {
  const enemy = spawnEnemy({
    name: "Wolf",
    level: overrides.level ?? 2,
    hp: 10,
    damageMin: overrides.damageMin ?? 3,
    damageMax: overrides.damageMax ?? 6,
    ...overrides,
  });
  if (overrides.broadcast) {
    return { ...enemy, broadcast: overrides.broadcast };
  }
  return enemy;
}

describe("formatEnemyIntentRollRange", () => {
  it("shows attack damage when foe is at or below hero level", () => {
    const enemy = testEnemy({ broadcast: "attack", level: 2, damageMin: 3, damageMax: 6 });
    expect(formatEnemyIntentRollRange(enemy, 2)).toBe("3–6");
    expect(formatEnemyIntentRollRange(enemy, 3)).toBe("3–6");
  });

  it("shows ??? for attack when foe is above hero level", () => {
    const enemy = testEnemy({ broadcast: "attack", level: 4 });
    expect(formatEnemyIntentRollRange(enemy, 3)).toBe("???");
  });

  it("shows defend armor range when readable", () => {
    const enemy = testEnemy({ broadcast: "defend", level: 1 });
    expect(formatEnemyIntentRollRange(enemy, 1)).toBe("1–4");
  });

  it("shows ??? for defend when foe is above hero level", () => {
    const enemy = testEnemy({ broadcast: "defend", level: 5 });
    expect(formatEnemyIntentRollRange(enemy, 4)).toBe("???");
  });
});

describe("formatEnemyBroadcastLine", () => {
  it("appends roll range to attack and defend telegraphs", () => {
    const attack = testEnemy({ broadcast: "attack", level: 2, damageMin: 5, damageMax: 5 });
    expect(formatEnemyBroadcastLine(attack, 2, false)).toBe("Attack 5");

    const defend = testEnemy({ broadcast: "defend", level: 2 });
    expect(formatEnemyBroadcastLine(defend, 2, false)).toBe("Defend 1–4");
  });

  it("leaves buff telegraphs unchanged", () => {
    const enemy = testEnemy({ broadcast: "buff", level: 1 });
    expect(formatEnemyBroadcastLine(enemy, 1, false)).toBe("Buff");
  });

  it("shows slain without roll info", () => {
    const enemy = testEnemy({ broadcast: "attack", level: 1 });
    expect(formatEnemyBroadcastLine(enemy, 5, true)).toBe("Slain");
  });
});
