import { Box, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import PondButton from "../PondButton";

export type ClosetItemModalNav = {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose?: () => void;
};

export function ClosetItemModalTopNav({ itemNav }: { itemNav: ClosetItemModalNav }) {
  return (
    <HStack w="100%" align="center" gap="2" flexWrap="nowrap">
      <Box flex="1" display="flex" justifyContent="flex-start">
        <PondButton
          type="button"
          size="sm"
          colorPalette="sky"
          disabled={!itemNav.hasPrev}
          onClick={itemNav.onPrev}
        >
          ← Previous
        </PondButton>
      </Box>
      <Box flex="1" display="flex" justifyContent="center">
        <PondButton
          type="button"
          size="sm"
          variant="outline"
          colorPalette="gray"
          onClick={itemNav.onClose}
        >
          Close
        </PondButton>
      </Box>
      <Box flex="1" display="flex" justifyContent="flex-end">
        <PondButton
          type="button"
          size="sm"
          colorPalette="sky"
          disabled={!itemNav.hasNext}
          onClick={itemNav.onNext}
        >
          Next →
        </PondButton>
      </Box>
    </HStack>
  );
}

type ClosetItemModalFooterProps = {
  borrowSlot?: ReactNode;
};

/** Borrow action below the card (hide lives beside title; prev/next in {@link ClosetItemModalTopNav}). */
export function ClosetItemModalFooter({ borrowSlot }: ClosetItemModalFooterProps) {
  if (!borrowSlot) return null;

  return (
    <HStack w="100%" justify="flex-end" align="center" flexWrap="wrap" gap="2">
      {borrowSlot}
    </HStack>
  );
}
