import {
  FOSSIL_SHOP_SPECIALTY_IDS,
  isFossilShopSpecialtyId,
  PETROGLYPH_I_SPECIALTY_ID,
} from "./fossilShop";
import { getSpecialtyDef, SPECIALTIES, type SpecialtyDef } from "./specialties";

export type PetroglyphSlot = {
  petroglyph_specialty_id: number;
  etched_specialty_id: number | null;
  etched_at_ms: number | null;
};

export function normalizePetroglyphSlots(raw: unknown): PetroglyphSlot[] {
  if (!Array.isArray(raw)) return [];
  const next: PetroglyphSlot[] = [];
  const etchedIds = new Set<number>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const petroglyphSpecialtyId = Number(o.petroglyph_specialty_id);
    if (!Number.isFinite(petroglyphSpecialtyId)) continue;
    if (!isFossilShopSpecialtyId(petroglyphSpecialtyId)) continue;
    const def = getSpecialtyDef(petroglyphSpecialtyId);
    if (!def || def.effect.type !== "petroglyph_slot") continue;

    let etchedSpecialtyId: number | null = null;
    if (o.etched_specialty_id != null) {
      const id = Number(o.etched_specialty_id);
      const etchedDef = getSpecialtyDef(id);
      if (
        Number.isFinite(id) &&
        etchedDef &&
        !etchedDef.fossilShopOnly &&
        !etchedIds.has(id)
      ) {
        etchedSpecialtyId = id;
        etchedIds.add(id);
      }
    }

    let etchedAtMs: number | null = null;
    if (o.etched_at_ms != null) {
      const ms = Number(o.etched_at_ms);
      if (Number.isFinite(ms) && ms > 0) etchedAtMs = ms;
    }
    if (etchedSpecialtyId != null && etchedAtMs == null) {
      etchedAtMs = Date.now();
    }

    next.push({
      petroglyph_specialty_id: petroglyphSpecialtyId,
      etched_specialty_id: etchedSpecialtyId,
      etched_at_ms: etchedAtMs,
    });
  }

  return next;
}

export function findPetroglyphSlotIndex(
  slots: readonly PetroglyphSlot[],
  petroglyphSpecialtyId: number,
): number {
  return slots.findIndex(
    (slot) => slot.petroglyph_specialty_id === petroglyphSpecialtyId,
  );
}

/** Energy-shop evolutions owned at cycle end; eligible to etch after pond reset. */
export function capturePetroglyphEtchPool(
  ownedSpecialties: Record<number, boolean>,
): number[] {
  const ids: number[] = [];
  for (const def of SPECIALTIES) {
    if (!ownedSpecialties[def.id] || def.fossilShopOnly) continue;
    ids.push(def.id);
  }
  return ids.sort((a, b) => a - b);
}

export function normalizePetroglyphEtchPool(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const entry of raw) {
    const id = Number(entry);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    const def = getSpecialtyDef(id);
    if (!def || def.fossilShopOnly) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.sort((a, b) => a - b);
}

/** Energy-shop evolutions that may be etched in the given slot (owned and/or etch pool). */
export function eligiblePetroglyphEvolutionDefs(
  ownedSpecialties: Record<number, boolean>,
  slots: readonly PetroglyphSlot[],
  editingSlotIndex?: number,
  etchPool?: readonly number[],
): SpecialtyDef[] {
  if (editingSlotIndex != null) {
    const editingSlot = slots[editingSlotIndex];
    if (editingSlot?.etched_specialty_id != null) return [];
  }

  const etchedInOtherSlots = new Set<number>();
  slots.forEach((slot, index) => {
    if (slot.etched_specialty_id == null) return;
    if (editingSlotIndex != null && index === editingSlotIndex) return;
    etchedInOtherSlots.add(slot.etched_specialty_id);
  });

  const eligibleIds = new Set<number>();
  for (const def of SPECIALTIES) {
    if (def.fossilShopOnly || etchedInOtherSlots.has(def.id)) continue;
    if (ownedSpecialties[def.id]) eligibleIds.add(def.id);
  }
  if (etchPool) {
    for (const id of etchPool) {
      if (etchedInOtherSlots.has(id)) continue;
      const def = getSpecialtyDef(id);
      if (def && !def.fossilShopOnly) eligibleIds.add(id);
    }
  }

  return SPECIALTIES.filter((def) => eligibleIds.has(def.id)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function applyPetroglyphsOnCycleStart(
  ownedSpecialties: Record<number, boolean>,
  specialtyAcquiredAtMs: Record<number, number>,
  slots: readonly PetroglyphSlot[],
): {
  owned_specialties: Record<number, boolean>;
  specialty_acquired_at_ms: Record<number, number>;
} {
  const nextOwned = { ...ownedSpecialties };
  const nextAcquired = { ...specialtyAcquiredAtMs };

  for (const slot of slots) {
    if (slot.etched_specialty_id == null) continue;
    nextOwned[slot.etched_specialty_id] = true;
    if (slot.etched_at_ms != null) {
      nextAcquired[slot.etched_specialty_id] = slot.etched_at_ms;
    }
  }

  return {
    owned_specialties: nextOwned,
    specialty_acquired_at_ms: nextAcquired,
  };
}

/** Merge etched slot evolutions into owned after a permanent etch. */
export function syncOwnedFromPetroglyphEtch(
  ownedSpecialties: Record<number, boolean>,
  specialtyAcquiredAtMs: Record<number, number>,
  slots: readonly PetroglyphSlot[],
): {
  owned_specialties: Record<number, boolean>;
  specialty_acquired_at_ms: Record<number, number>;
} {
  return applyPetroglyphsOnCycleStart(ownedSpecialties, specialtyAcquiredAtMs, slots);
}

export function isPetroglyphSlotBlank(slot: PetroglyphSlot | undefined): boolean {
  return slot?.etched_specialty_id == null;
}

export function petroglyphSlotCanEtch(
  ownedSpecialties: Record<number, boolean>,
  slots: readonly PetroglyphSlot[],
  slotIndex: number,
  etchPool?: readonly number[],
): boolean {
  if (slotIndex < 0 || slotIndex >= slots.length) return false;
  if (!isPetroglyphSlotBlank(slots[slotIndex])) return false;
  return (
    eligiblePetroglyphEvolutionDefs(
      ownedSpecialties,
      slots,
      slotIndex,
      etchPool,
    ).length > 0
  );
}

export function petroglyphSlotStatusLabel(
  slot: PetroglyphSlot | undefined,
): string {
  if (!slot || slot.etched_specialty_id == null) return "Blank";
  const etched = getSpecialtyDef(slot.etched_specialty_id);
  return etched ? etched.name : "Etched";
}

export function createBlankPetroglyphSlot(
  petroglyphSpecialtyId: number,
): PetroglyphSlot {
  return {
    petroglyph_specialty_id: petroglyphSpecialtyId,
    etched_specialty_id: null,
    etched_at_ms: null,
  };
}

export function isPetroglyphSpecialtyId(id: number): boolean {
  return id === PETROGLYPH_I_SPECIALTY_ID;
}

/** Ensure FOSSIL_SHOP_SPECIALTY_IDS petroglyph items have a slot row when owned. */
export function reconcilePetroglyphSlotsWithOwned(
  ownedSpecialties: Record<number, boolean>,
  slots: readonly PetroglyphSlot[],
): PetroglyphSlot[] {
  const next = [...slots];
  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    const def = getSpecialtyDef(id);
    if (!def || def.effect.type !== "petroglyph_slot") continue;
    if (!ownedSpecialties[id]) continue;
    if (findPetroglyphSlotIndex(next, id) >= 0) continue;
    next.push(createBlankPetroglyphSlot(id));
  }
  return next;
}
