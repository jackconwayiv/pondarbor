import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { GOALS_THEME } from "./theme";

import "./goalPatchShimmer.css";

type GoalPatchCircleProps = BoxProps & {
  patchStyle: { borderColor: string; bg: string };
  /** Static gold styling on earned badges. */
  goldShimmer?: boolean;
  /** Looping shine sweep (subset of gold badges). */
  goldShimmerAnimate?: boolean;
  overdueLabel?: string | null;
  overdueSublabel?: string | null;
  children: ReactNode;
};

/** Circular goal patch with optional ongoing gold badge shimmer. */
export function GoalPatchCircle({
  goldShimmer = false,
  goldShimmerAnimate = false,
  patchStyle,
  overdueLabel = null,
  overdueSublabel = null,
  children,
  className,
  ...rest
}: GoalPatchCircleProps) {
  const rootClass = [
    className,
    goldShimmer ? "goal-patch-gold-shimmer" : "",
    goldShimmer && goldShimmerAnimate ? "goal-patch-gold-shimmer-animate" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      {overdueLabel ? (
        <Box
          position="absolute"
          inset="0"
          zIndex={2}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          bg="rgba(224, 122, 47, 0.82)"
          borderRadius="full"
          px="2"
          textAlign="center"
          pointerEvents="none"
        >
          <Box as="span" fontSize="2xs" fontWeight="bold" color="white" lineHeight="short">
            {overdueLabel}
          </Box>
          {overdueSublabel ? (
            <Box as="span" fontSize="2xs" color="whiteAlpha.900" lineHeight="short" mt="0.5">
              {overdueSublabel}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
