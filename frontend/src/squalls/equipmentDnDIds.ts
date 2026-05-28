import type { EquipmentSlot } from "./shantiesTypes";

const SLOT_DROP_PREFIX = "squalls-equip-slot:";
const INVENTORY_DROP_ID = "squalls-equip-inventory";
const DRAG_SLOT_PREFIX = "squalls-equip-drag-slot:";
const DRAG_INV_PREFIX = "squalls-equip-drag-inv:";

export function equipmentSlotDropId(slot: EquipmentSlot): string {
  return `${SLOT_DROP_PREFIX}${slot}`;
}

export function equipmentInventoryDropId(): string {
  return INVENTORY_DROP_ID;
}

export function equipmentSlotDragId(slot: EquipmentSlot): string {
  return `${DRAG_SLOT_PREFIX}${slot}`;
}

export function equipmentInventoryDragId(index: number): string {
  return `${DRAG_INV_PREFIX}${index}`;
}

export function parseEquipmentSlotDropId(
  id: string | null | undefined,
): EquipmentSlot | null {
  if (!id?.startsWith(SLOT_DROP_PREFIX)) return null;
  const slot = id.slice(SLOT_DROP_PREFIX.length);
  if (
    slot === "melee" ||
    slot === "ranged" ||
    slot === "armor" ||
    slot === "relic"
  ) {
    return slot;
  }
  return null;
}

export function isEquipmentInventoryDropId(id: string | null | undefined): boolean {
  return id === INVENTORY_DROP_ID;
}

export type ParsedEquipmentDrag =
  | { source: "slot"; slot: EquipmentSlot }
  | { source: "inventory"; index: number };

export function parseEquipmentDragId(
  id: string | null | undefined,
): ParsedEquipmentDrag | null {
  if (!id) return null;
  if (id.startsWith(DRAG_SLOT_PREFIX)) {
    const slot = id.slice(DRAG_SLOT_PREFIX.length);
    if (
      slot === "melee" ||
      slot === "ranged" ||
      slot === "armor" ||
      slot === "relic"
    ) {
      return { source: "slot", slot };
    }
    return null;
  }
  if (id.startsWith(DRAG_INV_PREFIX)) {
    const index = Number.parseInt(id.slice(DRAG_INV_PREFIX.length), 10);
    if (Number.isInteger(index) && index >= 0) {
      return { source: "inventory", index };
    }
  }
  return null;
}
