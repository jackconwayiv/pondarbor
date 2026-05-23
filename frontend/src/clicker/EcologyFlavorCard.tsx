import {
  Box,
  IconButton,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
  useMediaQuery,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

import {
  ecologyPopoverContentProps,
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "./ecologyUi.constants.ts";
import { EcologyBlurbText } from "./ecologyUi.tsx";
import { CLICKER_SURFACES } from "./clickerTheme";

function EcologyHelpMobileButton({
  label,
  ecologyNote,
}: {
  label: string;
  ecologyNote: string;
}) {
  const trigger = (
    <IconButton
      variant="plain"
      borderRadius="full"
      bg={CLICKER_SURFACES.active}
      color="black"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="black"
      minW="1.0625rem"
      w="1.0625rem"
      h="1.0625rem"
      minH="1.0625rem"
      fontSize="8px"
      fontWeight="extrabold"
      lineHeight="1"
      p="0"
      flexShrink={0}
      aria-label={`Ecology note: ${label}`}
      _hover={{ bg: "gray.100" }}
      _active={{ bg: CLICKER_SURFACES.inactive }}
    >
      ?
    </IconButton>
  );

  return (
    <PopoverRoot positioning={{ placement: "bottom-end" }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverPositioner>
        <PopoverContent
          {...ecologyPopoverContentProps}
          w={{ base: "calc(100vw - 2rem)", md: "auto" }}
        >
          <PopoverBody bg={CLICKER_SURFACES.active} color="black" p="3" border="none">
            <EcologyBlurbText>{ecologyNote}</EcologyBlurbText>
          </PopoverBody>
        </PopoverContent>
      </PopoverPositioner>
    </PopoverRoot>
  );
}

export function EcologyFlavorCard({
  label,
  ecologyNote,
  listRevision,
  children,
}: {
  label: string;
  ecologyNote: string;
  listRevision?: string;
  children: ReactNode;
}) {
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    { ssr: false, fallback: [false] },
  );

  const cardBody = (
    <Box position="relative" w="full">
      {!canHoverFinePointer ? (
        <Box position="absolute" top="0.375rem" right="0.375rem" zIndex={1}>
          <EcologyHelpMobileButton label={label} ecologyNote={ecologyNote} />
        </Box>
      ) : null}
      {children}
    </Box>
  );

  if (canHoverFinePointer) {
    return (
      <TooltipRoot
        key={`eco-${label}-${listRevision ?? "0"}`}
        {...ecologyTooltipRootBaseProps}
        openDelay={1000}
        positioning={{ placement: "top-start" }}
      >
        <TooltipTrigger asChild>
          <div style={{ width: "100%", minWidth: 0, display: "block" }}>{cardBody}</div>
        </TooltipTrigger>
        <TooltipPositioner>
          <TooltipContent {...ecologyTooltipSurfaceProps}>
            <EcologyBlurbText>{ecologyNote}</EcologyBlurbText>
          </TooltipContent>
        </TooltipPositioner>
      </TooltipRoot>
    );
  }

  return cardBody;
}
