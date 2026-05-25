import {
  IconButton,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  Portal,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

import {
  ecologyPopoverContentProps,
  shopHelpPopoverPositionerProps,
  shopHelpPopoverRootProps,
} from "../clicker/ecologyUi.constants";
import { CLICKER_SURFACES } from "../clicker/clickerTheme";

export function ShopHelpMobilePopover({
  ariaLabel,
  onOpenChange,
  children,
}: {
  ariaLabel: string;
  onOpenChange?: (details: { open: boolean }) => void;
  children: ReactNode;
}) {
  return (
    <PopoverRoot {...shopHelpPopoverRootProps} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <IconButton
          variant="plain"
          borderRadius="full"
          bg={CLICKER_SURFACES.active}
          color="black"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="black"
          minW="1rem"
          w="1rem"
          h="1rem"
          minH="1rem"
          fontSize="8px"
          fontWeight="extrabold"
          lineHeight="1"
          p="0"
          flexShrink={0}
          aria-label={ariaLabel}
          _hover={{ bg: "gray.100" }}
          _active={{ bg: CLICKER_SURFACES.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          ?
        </IconButton>
      </PopoverTrigger>
      <Portal>
        <PopoverPositioner {...shopHelpPopoverPositionerProps}>
          <PopoverContent
            {...ecologyPopoverContentProps}
            {...shopHelpPopoverPositionerProps}
            w={{ base: "calc(100vw - 2rem)", md: "auto" }}
          >
            <PopoverBody bg={CLICKER_SURFACES.active} color="black" p="3" border="none">
              {children}
            </PopoverBody>
          </PopoverContent>
        </PopoverPositioner>
      </Portal>
    </PopoverRoot>
  );
}
