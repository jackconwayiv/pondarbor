import { Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** High-contrast tooltip / popover surface (avoids theme “dark on dark” tooltips). */
export const ecologyTooltipSurfaceProps = {
  bg: "white",
  color: "black",
  borderWidth: "1px",
  borderColor: "black",
  borderStyle: "solid" as const,
  maxW: "280px",
  px: "2.5",
  py: "2",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};

export const ecologyPopoverContentProps = {
  bg: "white",
  color: "black",
  borderWidth: "1px",
  borderColor: "black",
  borderStyle: "solid" as const,
  maxW: "280px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};

export function EcologyBlurbText({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="xs" color="black" lineHeight="1.45">
      {children}
    </Text>
  );
}
