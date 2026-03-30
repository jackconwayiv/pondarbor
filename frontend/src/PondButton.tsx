import { Button as ChakraButton } from "@chakra-ui/react";
import type { ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";

/**
 * App-wide button styling:
 * - defaults to `variant="solid"`
 * - on hover, visually transitions to an "outline-like" look
 *   using the currently selected `colorPalette`.
 */
const PondButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, _hover, colorPalette, ...props }, ref) => {
    return (
      <ChakraButton
        ref={ref}
        variant={variant ?? "solid"}
        colorPalette={colorPalette}
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

