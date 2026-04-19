import { Button as ChakraButton } from "@chakra-ui/react";
import type { ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";

/**
 * QFF shell buttons: same hover behavior as PondButton, but default label color is light
 * so text stays readable on the dark `#0c0c0c` layout (PondButton defaults to black).
 */
const QffButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ color, variant, _hover, colorPalette, borderRadius, size, ...props }, ref) => {
    return (
      <ChakraButton
        ref={ref}
        variant={variant ?? "solid"}
        size={size ?? "md"}
        borderRadius={borderRadius ?? "xl"}
        colorPalette={colorPalette}
        color={color ?? "white"}
        _hover={{
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

QffButton.displayName = "QffButton";

export default QffButton;
