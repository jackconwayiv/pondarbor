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
 * - defaults to `variant="solid"`
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
    const isSolid = (variant ?? "solid") === "solid";
    const isFilterButton = uiClass === "filter";
    const wantsWhiteText =
      isSolid &&
      (colorPalette === "orange" ||
        colorPalette === "nautical" ||
        colorPalette === "forest" ||
        colorPalette === "sky" ||
        colorPalette === "teal" ||
        colorPalette === "lilypad");
    const filterStyles = isFilterButton
      ? uiActive
        ? {
            variant: "outline" as const,
            colorPalette: "gray" as const,
            bg: "white",
            color: "gray.600",
            borderColor: "gray.300",
            borderWidth: "1px",
            _hover: {
              bg: "gray.50",
              color: "gray.600",
              borderColor: "gray.300",
              ..._hover,
            },
          }
        : {
            variant: "solid" as const,
            colorPalette: "gray" as const,
            bg: "gray.400",
            color: "white",
            borderColor: "gray.400",
            borderWidth: "1px",
            _hover: {
              bg: "gray.300",
              color: "white",
              borderColor: "gray.300",
              ..._hover,
            },
          }
      : null;
    return (
      <ChakraButton
        ref={ref}
        variant={filterStyles?.variant ?? (variant ?? "solid")}
        size={size ?? "md"}
        borderRadius={borderRadius ?? "xl"}
        colorPalette={filterStyles?.colorPalette ?? colorPalette}
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

