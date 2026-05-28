const HAND_CARD_DRAG_PREFIX = "squalls-hand-card:";
const ENEMY_DROP_PREFIX = "squalls-enemy:";
export const DEFEND_DROP_ZONE_ID = "squalls-defend-zone";

export function handCardDragId(handIndex: number): string {
  return `${HAND_CARD_DRAG_PREFIX}${handIndex}`;
}

export function parseHandCardDragId(id: unknown): number | null {
  if (typeof id !== "string" || !id.startsWith(HAND_CARD_DRAG_PREFIX)) {
    return null;
  }
  const index = Number.parseInt(id.slice(HAND_CARD_DRAG_PREFIX.length), 10);
  return Number.isFinite(index) ? index : null;
}

export function enemyDropId(enemyIndex: number): string {
  return `${ENEMY_DROP_PREFIX}${enemyIndex}`;
}

export function parseEnemyDropId(id: unknown): number | null {
  if (typeof id !== "string" || !id.startsWith(ENEMY_DROP_PREFIX)) {
    return null;
  }
  const index = Number.parseInt(id.slice(ENEMY_DROP_PREFIX.length), 10);
  return Number.isFinite(index) ? index : null;
}

export function isDefendDropId(id: unknown): boolean {
  return id === DEFEND_DROP_ZONE_ID;
}
