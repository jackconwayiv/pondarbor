import { Box, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent, ReactNode } from "react";
import { APP_TEXT_SIZES } from "../theme/typography";

type InteractiveProps = {
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  tabIndex?: number;
  role?: string;
  "aria-label"?: string;
  disabled?: boolean;
};

type EmptyOrScheduledProps = InteractiveProps & {
  variant: "emptyInput" | "scheduled";
  children?: ReactNode;
};

type WeekDotProps = {
  variant: "weekDot";
  isFilled: boolean;
};

export type MealPlanSlotCellProps = EmptyOrScheduledProps | WeekDotProps;

export function MealPlanSlotCell(props: MealPlanSlotCellProps) {
  if (props.variant === "weekDot") {
    const { isFilled } = props;
    return (
      <Box
        minH="6"
        minW="6"
        w="100%"
        borderRadius="sm"
        borderWidth="1px"
        borderColor={isFilled ? "lilypad.solid" : "border"}
        bg={isFilled ? "lilypad.solid" : "bg"}
        aria-hidden
      />
    );
  }

  const { variant, children, onClick, onKeyDown, tabIndex, role, "aria-label": ariaLabel, disabled } =
    props;
  const isEmpty = variant === "emptyInput";

  return (
    <Box
      role={role ?? (onClick ? "button" : undefined)}
      tabIndex={tabIndex ?? (onClick && !disabled ? 0 : undefined)}
      minH="12"
      px="2"
      py="2"
      borderRadius="md"
      borderWidth="1px"
      borderStyle={isEmpty ? "dashed" : "solid"}
      borderColor={isEmpty ? "border" : "lilypad.emphasized"}
      bg={isEmpty ? "bg" : "lilypad.subtle"}
      cursor={disabled ? "not-allowed" : onClick ? "pointer" : undefined}
      opacity={disabled ? 0.65 : 1}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {isEmpty ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted" fontWeight="normal">
          {children ?? "Add a meal…"}
        </Text>
      ) : (
        <Stack gap="1">{children}</Stack>
      )}
    </Box>
  );
}
