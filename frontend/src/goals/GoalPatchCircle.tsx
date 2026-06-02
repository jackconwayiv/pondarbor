import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { GOALS_THEME } from "./theme";

import "./goalPatchShimmer.css";

type GoalPatchCircleProps = BoxProps & {
  patchStyle: { borderColor: string; bg: string };
  /** Ongoing gold shimmer on earned badges. */
  goldShimmer?: boolean;
  children: ReactNode;
};

/** Circular goal patch with optional ongoing gold badge shimmer. */
export function GoalPatchCircle({
  goldShimmer = false,
  patchStyle,
  children,
  className,
  ...rest
}: GoalPatchCircleProps) {
  const rootClass = [className, goldShimmer ? "goal-patch-gold-shimmer" : ""].filter(Boolean).join(" ");

  return (
    <Box
      position="relative"
      overflow="hidden"
      borderRadius="full"
      border="2px solid"
      borderColor={patchStyle.borderColor}
      bg={patchStyle.bg}
      boxShadow="sm"
      display="flex"
      alignItems="center"
      justifyContent="center"
      className={rootClass || undefined}
      _hover={{ borderColor: GOALS_THEME.lakeBlue }}
      transition="background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease"
      {...rest}
    >
      <Box position="relative" zIndex={1} width="full" display="flex" flexDirection="column" alignItems="center">
        {children}
      </Box>
    </Box>
  );
}
