import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";

import EquipmentCard from "./EquipmentCard";
import {
  equipmentInventoryDragId,
  equipmentInventoryDropId,
  equipmentSlotDragId,
  equipmentSlotDropId,
  isEquipmentInventoryDropId,
  parseEquipmentDragId,
  parseEquipmentSlotDropId,
} from "./equipmentDnDIds";
import {
  applyEquipmentMove,
  EQUIPMENT_SLOT_LABELS,
  visibleEquipmentSlots,
  type EquipmentDragTo,
} from "./shantiesEquipment";
import type { EquipmentId, EquipmentSlot, HeroType } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  onEquipmentChange: (hero: HeroType) => void;
};

function EquipmentSlotDrop({
  slot,
  equipmentId,
  children,
}: {
  slot: EquipmentSlot;
  equipmentId: EquipmentId | null;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: equipmentSlotDropId(slot),
  });

  return (
    <Box
      ref={setNodeRef}
      minH="6.5rem"
      borderRadius="lg"
      borderWidth="2px"
      borderStyle={equipmentId ? "solid" : "dashed"}
      borderColor={isOver ? "purple.500" : "blackAlpha.300"}
      bg={isOver ? "purple.50" : "blackAlpha.50"}
      p={1.5}
      position="relative"
    >
      <Text
        fontSize="2xs"
        color="gray.900"
        textTransform="uppercase"
        letterSpacing="wide"
        mb={1}
        px={0.5}
      >
        {EQUIPMENT_SLOT_LABELS[slot]}
      </Text>
      <Box minH="5.5rem">{children}</Box>
    </Box>
  );
}

function EquipmentInventoryDrop({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: equipmentInventoryDropId(),
  });

  return (
    <Box
      ref={setNodeRef}
      borderRadius="lg"
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={isOver ? "purple.500" : "blackAlpha.300"}
      bg={isOver ? "purple.50" : "blackAlpha.50"}
      p={2}
      minH="7rem"
    >
      {children}
    </Box>
  );
}

export default function CharacterSheetEquipment({
  hero,
  onEquipmentChange,
}: Props) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const activeDrag = parseEquipmentDragId(activeDragId);
  const activeEquipmentId =
    activeDrag?.source === "slot"
      ? hero.equipped[activeDrag.slot]
      : activeDrag?.source === "inventory"
        ? hero.equipmentInventory[activeDrag.index]
        : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const from = parseEquipmentDragId(event.active.id as string);
    if (!from) return;

    const overId = event.over?.id as string | undefined;
    let to: EquipmentDragTo | null = null;
    const slot = parseEquipmentSlotDropId(overId);
    if (slot) {
      to = { target: "slot", slot };
    } else if (isEquipmentInventoryDropId(overId)) {
      to = { target: "inventory" };
    }
    if (!to) return;

    const next = applyEquipmentMove(hero, from, to);
    if (next !== hero) {
      onEquipmentChange(next);
    }
  };

  const equippedSlots = visibleEquipmentSlots(hero);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event: DragStartEvent) =>
        setActiveDragId(String(event.active.id))
      }
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <VStack align="stretch" gap={3}>
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Equipped
          </Text>
          <SimpleGrid columns={3} gap={2}>
            {equippedSlots.map((slot) => {
              const equipmentId = hero.equipped[slot];
              return (
                <EquipmentSlotDrop
                  key={slot}
                  slot={slot}
                  equipmentId={equipmentId}
                >
                  {equipmentId ? (
                    <EquipmentCard
                      equipmentId={equipmentId}
                      dragId={equipmentSlotDragId(slot)}
                    />
                  ) : (
                    <Text fontSize="xs" color="gray.900" textAlign="center" py={6}>
                      Empty
                    </Text>
                  )}
                </EquipmentSlotDrop>
              );
            })}
          </SimpleGrid>
        </Box>

        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Equipment bag
          </Text>
          <EquipmentInventoryDrop>
            {hero.equipmentInventory.length === 0 ? (
              <Text fontSize="sm" color="gray.900" textAlign="center" py={4}>
                Drag gear here to unequip.
              </Text>
            ) : (
              <SimpleGrid columns={3} gap={1.5}>
                {hero.equipmentInventory.map((equipmentId, index) => (
                  <EquipmentCard
                    key={`${equipmentId}-${index}`}
                    equipmentId={equipmentId}
                    dragId={equipmentInventoryDragId(index)}
                  />
                ))}
              </SimpleGrid>
            )}
          </EquipmentInventoryDrop>
        </Box>
      </VStack>

      <DragOverlay dropAnimation={null}>
        {activeEquipmentId ? (
          <Box w="5.5rem" pointerEvents="none">
            <EquipmentCard
              equipmentId={activeEquipmentId}
              dragId="overlay"
              disabled
            />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
