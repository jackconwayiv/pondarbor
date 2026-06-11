import { Badge, Text } from "@chakra-ui/react";
import { APP_TEXT_SIZES } from "../theme/typography";

type MealPantryCoverageBadgeProps = {
  pct: number;
  /** `chip` on meal list rows; `inline` on detail; `overlay` on thumbnails (legacy). */
  variant?: "chip" | "inline" | "overlay";
};

export function MealPantryCoverageBadge({
  pct,
  variant = "chip",
}: MealPantryCoverageBadgeProps) {
  const label = `${pct}%`;
  if (variant === "inline") {
    return (
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
        Pantry: {label}
      </Text>
    );
  }
  if (variant === "overlay") {
    return (
      <Badge
        position="absolute"
        top="1"
        right="1"
        size="sm"
        colorPalette={pct >= 100 ? "lilypad" : "gray"}
        variant={pct >= 100 ? "solid" : "subtle"}
        zIndex={1}
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      size="sm"
      colorPalette={pct >= 100 ? "lilypad" : "gray"}
      variant={pct >= 100 ? "solid" : "subtle"}
      alignSelf="flex-start"
    >
      Pantry {label}
    </Badge>
  );
}
