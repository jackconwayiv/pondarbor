import { Button as ChakraButton } from "@chakra-ui/react";
import type { ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";
import { APP_MOTION } from "./theme/motion";

/**
 * App-wide button styling:
 * - defaults to `variant="solid"`
 * - on hover, visually transitions to an "outline-like" look
 *   using the currently selected `colorPalette`.
 */
const PondButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, _hover, colorPalette, borderRadius, size, color, ...props }, ref) => {
    return (
      <ChakraButton
        ref={ref}
        variant={variant ?? "solid"}
        size={size ?? "md"}
        borderRadius={borderRadius ?? "xl"}
        colorPalette={colorPalette}
        color={color}
        transition={`background ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}, border-color ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}, color ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}`}
        _hover={{
          // Outline-like hover: white background + colored border.
          // (Site chrome uses a white background token `bg`.)
          bg: "bg",
          borderColor: "colorPalette.border",
          borderWidth: "1px",
          color: "colorPalette.fg",
          ..._hover,
        }}
        {...props}
      />
    );
  },
);

PondButton.displayName = "PondButton";

export default PondButton;

