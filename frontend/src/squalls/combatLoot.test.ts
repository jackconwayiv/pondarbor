import { describe, expect, it } from "vitest";

import { generateCombatLoot, xpDropForEnemy } from "./combatLoot";
import { spawnEnemy } from "./combatRules";

describe("combat loot xp", () => {
  it("uses monster template level, not rolled encounter level", () => {
    const siren = spawnEnemy({
      name: "Siren",
      level: 2,
      hp: 9,
      traits: ["evasive"],
    });
    expect(xpDropForEnemy(siren)).toBe(1);
  });

  it("awards 1 xp total for one template L1 siren", () => {
    const siren = spawnEnemy({
      name: "Siren",
      level: 2,
      hp: 9,
      traits: ["evasive"],
    });
    const loot = generateCombatLoot([siren]);
    const xp = loot.find((entry) => entry.kind === "xp");
    expect(xp?.amount).toBe(1);
  });

  it("awards boss xp from template level", () => {
    const boss = spawnEnemy({
      name: "Cave Matriarch",
      level: 4,
      hp: 20,
      isBoss: true,
      traits: ["evasive"],
    });
    expect(xpDropForEnemy(boss)).toBe(3);
  });
});
