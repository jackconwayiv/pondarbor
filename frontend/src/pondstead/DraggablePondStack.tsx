import { Box, Button, Text } from "@chakra-ui/react";

import { type UnitStack, stackAriaLabel, unitEmoji } from "./pondsteadUnits";

/** Renders a unit stack on a tile; opens the unit actions modal (march is in the modal). */
export default function DraggablePondStack({
  stack,
  fontPx,
  slotMaxW,
  interactionLocked,
  noAdjacentMovesRemaining,
  onOpenUnitActions,
}: {
  stack: UnitStack;
  fontPx: number;
  /** Max width for one stack so three fit per row with the tile unit-row `gap` (e.g. `calc((100% - 2 * gap) / 3)`). */
  slotMaxW: string;
  interactionLocked: boolean;
  /** When true (march budget prevents any adjacent tile step today), draws a dashed border. */
  noAdjacentMovesRemaining: boolean;
  onOpenUnitActions: () => void;
}) {
  const numPx = Math.max(8, Math.floor(fontPx * 0.5));

  return (
    <Box
      position="relative"
      zIndex={2}
      flex={`0 1 ${slotMaxW}`}
      minW={0}
      maxW={slotMaxW}
    >
      <Button
        type="button"
        variant="ghost"
        w="100%"
        minW={0}
        px="0.06rem"
        py="0.1rem"
        minH="1rem"
        h="auto"
        fontSize={`${fontPx}px`}
        lineHeight="1.15"
        borderRadius="sm"
        bg="white/25"
        borderWidth="1px"
        borderStyle={noAdjacentMovesRemaining ? "dashed" : "solid"}
        borderColor="black/12"
        _hover={{ bg: "white/40" }}
        disabled={interactionLocked}
        cursor={interactionLocked ? "not-allowed" : "pointer"}
        aria-label={
          stackAriaLabel(stack.kind, stack.count) +
          (noAdjacentMovesRemaining ? ", no move points left today" : "")
        }
        aria-haspopup="dialog"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="0.05rem"
        onClick={onOpenUnitActions}
      >
        <Text as="span" fontSize={`${fontPx}px`} lineHeight="1">
          {unitEmoji(stack.kind)}
        </Text>
        <Text as="span" fontSize={`${numPx}px`} fontWeight="semibold" lineHeight="1" textAlign="center">
          {stack.count}
        </Text>
      </Button>
    </Box>
  );
}
