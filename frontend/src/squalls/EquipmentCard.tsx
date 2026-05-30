import { Text, chakra } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { useDraggable } from "@dnd-kit/core";

import { EQUIPMENT_DEFINITIONS } from "./shantiesEquipment";
import type { EquipmentId } from "./shantiesTypes";

const CardRoot = chakra("div");

type FaceProps = {
  equipmentId: EquipmentId;
  rootProps?: ComponentProps<typeof CardRoot>;
};

/** Static equipment tile (equip tab look, no drag). */
export function EquipmentCardFace({ equipmentId, rootProps }: FaceProps) {
  const def = EQUIPMENT_DEFINITIONS[equipmentId];

  return (
    <CardRoot
      w="100%"
      aspectRatio="1"
      minH="5.5rem"
      p={2}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      borderRadius="lg"
      borderWidth="2px"
      borderColor="purple.400"
      bg="white"
      color="gray.900"
      boxShadow="sm"
      title={def.description}
      {...rootProps}
    >
      <Text fontSize="xl" lineHeight={1} aria-hidden>
        {def.emoji}
      </Text>
      <Text
        fontSize="xs"
        fontWeight="bold"
        textAlign="center"
        lineHeight="short"
        px={1}
      >
        {def.name}
      </Text>
    </CardRoot>
  );
}

type Props = {
  equipmentId: EquipmentId;
  dragId: string;
  disabled?: boolean;
};

export default function EquipmentCard({
  equipmentId,
  dragId,
  disabled = false,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    disabled,
    data: { equipmentId },
  });

  return (
    <EquipmentCardFace
      equipmentId={equipmentId}
      rootProps={{
        ref: setNodeRef,
        ...listeners,
        ...attributes,
        cursor: disabled ? "default" : "grab",
        opacity: isDragging ? 0.35 : 1,
        touchAction: "none",
      }}
    />
  );
}
