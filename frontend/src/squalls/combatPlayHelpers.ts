import type { CombatCard, CombatLogEntry, EnemyType, EquippedGear } from "./shantiesTypes";
import {
  applyAttackDamageToEnemy,
  clampHp,
  combatLogLine,
  formatPlayerAttackLog,
  isEnemyAlive,
} from "./combatRules";
import {
  formatMissLog,
  formatShockingRetaliationLog,
  rollAttackDamage,
  rollDefendArmor,
  rollMeleeMiss,
  rollUniform,
  shockingRetaliationDamage,
} from "./combatEquipment";
import { applyWeakenedToDamage } from "./enemyActions";
import {
  getAttackKind,
  isStealCard,
  isSwishCard,
} from "./shantiesTypes";

export type MeleeAttackOutcome = {
  updatedEnemies: EnemyType[];
  log: CombatLogEntry[];
  heroHpDelta: number;
  heroSlain: boolean;
  goldStolen: number;
};

export function applyMeleeAttackToEnemyIndex(
  enemies: EnemyType[],
  targetIndex: number,
  equipped: EquippedGear,
  card: CombatCard,
  heroName: string,
  heroHp: number,
  heroWeakened: boolean,
): MeleeAttackOutcome {
  const log: CombatLogEntry[] = [];
  let updatedEnemies = [...enemies];
  let heroHpDelta = 0;
  let heroSlain = false;
  let goldStolen = 0;

  const target = updatedEnemies[targetIndex];
  if (!target || !isEnemyAlive(target)) {
    return { updatedEnemies, log, heroHpDelta, heroSlain, goldStolen };
  }

  if (rollMeleeMiss(target)) {
    log.push(combatLogLine(formatMissLog(heroName, target.name), "hero"));
    return { updatedEnemies, log, heroHpDelta, heroSlain, goldStolen };
  }

  const rawDamage = rollAttackDamage(equipped, card);
  const damage = applyWeakenedToDamage(rawDamage, heroWeakened);
  const attackResult = applyAttackDamageToEnemy(target, damage);
  updatedEnemies[targetIndex] = attackResult.enemy;
  log.push(
    combatLogLine(
      formatPlayerAttackLog(
        heroName,
        target.name,
        attackResult.armorBroken,
        attackResult.damageDealt,
      ),
      "hero",
    ),
  );

  if (isStealCard(card) && attackResult.damageDealt > 0) {
    goldStolen = rollUniform(1, 4);
    log.push(
      combatLogLine(
        `${heroName} steals ${goldStolen} gold from ${target.name}!`,
        "hero",
      ),
    );
  }

  const shockDamage = shockingRetaliationDamage(target);
  if (shockDamage > 0) {
    heroHpDelta -= shockDamage;
    log.push(
      combatLogLine(
        formatShockingRetaliationLog(heroName, target.name, shockDamage),
        "enemy",
      ),
    );
    if (clampHp(heroHp + heroHpDelta) <= 0) {
      heroSlain = true;
      log.push(combatLogLine(`${heroName} has been slain!`, "enemy"));
    }
  }

  if (attackResult.enemy.hp <= 0) {
    log.push(combatLogLine(`${target.name} has been slain!`, "hero"));
  }

  return { updatedEnemies, log, heroHpDelta, heroSlain, goldStolen };
}

export function applyRangedAttackToEnemyIndex(
  enemies: EnemyType[],
  targetIndex: number,
  equipped: EquippedGear,
  card: CombatCard,
  heroName: string,
  heroWeakened: boolean,
): { updatedEnemies: EnemyType[]; log: CombatLogEntry[] } {
  const log: CombatLogEntry[] = [];
  let updatedEnemies = [...enemies];

  const target = updatedEnemies[targetIndex];
  if (!target || !isEnemyAlive(target)) {
    return { updatedEnemies, log };
  }

  const rawDamage = rollAttackDamage(equipped, card);
  const damage = applyWeakenedToDamage(rawDamage, heroWeakened);
  const attackResult = applyAttackDamageToEnemy(target, damage);
  updatedEnemies[targetIndex] = attackResult.enemy;
  log.push(
    combatLogLine(
      formatPlayerAttackLog(
        heroName,
        target.name,
        attackResult.armorBroken,
        attackResult.damageDealt,
      ),
      "hero",
    ),
  );
  if (attackResult.enemy.hp <= 0) {
    log.push(combatLogLine(`${target.name} has been slain!`, "hero"));
  }

  return { updatedEnemies, log };
}

export function applyAllEnemiesAttack(
  enemies: EnemyType[],
  equipped: EquippedGear,
  card: CombatCard,
  heroName: string,
  heroHp: number,
  heroWeakened: boolean,
): {
  updatedEnemies: EnemyType[];
  log: CombatLogEntry[];
  heroHpDelta: number;
  heroSlain: boolean;
  goldStolen: number;
} {
  let updatedEnemies = [...enemies];
  const log: CombatLogEntry[] = [];
  let heroHpDelta = 0;
  let heroSlain = false;
  let goldStolen = 0;
  const isMelee = getAttackKind(card) === "melee";

  for (let i = 0; i < updatedEnemies.length; i++) {
    const enemy = updatedEnemies[i];
    if (!enemy || !isEnemyAlive(enemy)) continue;

    if (isMelee) {
      const result = applyMeleeAttackToEnemyIndex(
        updatedEnemies,
        i,
        equipped,
        card,
        heroName,
        heroHp + heroHpDelta,
        heroWeakened,
      );
      updatedEnemies = result.updatedEnemies;
      log.push(...result.log);
      heroHpDelta += result.heroHpDelta;
      goldStolen += result.goldStolen;
      if (result.heroSlain) heroSlain = true;
    } else {
      const result = applyRangedAttackToEnemyIndex(
        updatedEnemies,
        i,
        equipped,
        card,
        heroName,
        heroWeakened,
      );
      updatedEnemies = result.updatedEnemies;
      log.push(...result.log);
    }
  }

  return { updatedEnemies, log, heroHpDelta, heroSlain, goldStolen };
}

export function applySelfDefendCard(
  card: CombatCard,
  equipped: EquippedGear,
  heroName: string,
  currentArmor: number,
): {
  nextArmor: number;
  evasiveStacksGained: number;
  log: CombatLogEntry[];
} {
  const gained = rollDefendArmor(equipped, card);
  const nextArmor = currentArmor + gained;
  const log = [
    combatLogLine(
      `${heroName} gains ${gained} armor`,
      "hero",
    ),
  ];
  const evasiveStacksGained = isSwishCard(card) ? 1 : 0;
  if (evasiveStacksGained > 0) {
    log.push(
      combatLogLine(`${heroName} takes an evasive stance.`, "hero"),
    );
  }
  return { nextArmor, evasiveStacksGained, log };
}
