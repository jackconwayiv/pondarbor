import { Button as ChakraButton } from "@chakra-ui/react";
import type { ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";
import { APP_MOTION } from "./theme/motion";

type PondButtonProps = ButtonProps & {
  /** Reusable visual role for filter-toggle buttons. */
  uiClass?: "filter";
  /** Active/open state for `uiClass="filter"`. */
  uiActive?: boolean;
};

/**
 * App-wide button styling:
 * - defaults to `variant="solid"` with `colorPalette="lilypad"` (primary actions)
 * - on hover, visually transitions to an "outline-like" look
 *   using the currently selected `colorPalette`.
 */
const PondButton = forwardRef<HTMLButtonElement, PondButtonProps>(
  (
    {
      variant,
      _hover,
      colorPalette,
      borderRadius,
      size,
      color,
      uiClass,
      uiActive,
      ...props
    },
    ref,
  ) => {
    const resolvedVariant = variant ?? "solid";
    const isSolid = resolvedVariant === "solid";
    const isFilterButton = uiClass === "filter";
    const resolvedPalette =
      colorPalette ?? (isFilterButton ? undefined : isSolid ? "lilypad" : undefined);
    const wantsWhiteText =
      isSolid &&
      resolvedPalette !== undefined &&
      (resolvedPalette === "lilypad" ||
        resolvedPalette === "teal" ||
        resolvedPalette === "orange" ||
        resolvedPalette === "nautical" ||
        resolvedPalette === "navy" ||
        resolvedPalette === "deep");
    const filterStyles = isFilterButton
      ? uiActive
        ? {
            variant: "outline" as const,
            colorPalette: "sky" as const,
            bg: "white",
            color: "sky.fg",
            borderColor: "sky.border",
            borderWidth: "1px",
            _hover: {
              bg: "sky.subtle",
              color: "sky.fg",
              borderColor: "sky.border",
              ..._hover,
            },
          }
        : {
            variant: "solid" as const,
            colorPalette: "sky" as const,
            bg: "sky.solid",
            color: "white",
            borderColor: "sky.solid",
            borderWidth: "1px",
            _hover: {
              bg: "sky.emphasized",
              color: "white",
              borderColor: "sky.emphasized",
              ..._hover,
            },
          }
      : null;
    return (
      <ChakraButton
        ref={ref}
        variant={filterStyles?.variant ?? resolvedVariant}
        size={size ?? "md"}
        borderRadius={borderRadius ?? "xl"}
        colorPalette={filterStyles?.colorPalette ?? resolvedPalette}
        bg={filterStyles?.bg}
        borderColor={filterStyles?.borderColor}
        borderWidth={filterStyles?.borderWidth}
        color={filterStyles?.color ?? color ?? (wantsWhiteText ? "white" : undefined)}
        transition={`background ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}, border-color ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}, color ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}`}
        _hover={
          filterStyles?._hover ?? {
            // Outline-like hover: soft neutral background + colored border.
            bg: "bg.subtle",
            borderColor: "colorPalette.border",
            borderWidth: "1px",
            color: "colorPalette.fg",
            ..._hover,
          }
        }
        {...props}
      />
    );
  },
);

PondButton.displayName = "PondButton";

export default PondButton;

