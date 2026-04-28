import { Box, Button, HStack, Text } from "@chakra-ui/react";

/** Must match backend `FACTION_COLORS` in `backend/pondstead/views.py`. */
export const PONDSTEAD_FACTION_COLORS = ["blue", "red", "green", "yellow", "purple", "orange"] as const;
export type PondsteadFactionColorKey = (typeof PONDSTEAD_FACTION_COLORS)[number];

const SWATCH_HEX: Record<PondsteadFactionColorKey, string> = {
  blue: "#2B6CB0",
  red: "#C53030",
  green: "#276749",
  yellow: "#B7791F",
  purple: "#6B46C1",
  orange: "#C05621",
};

export function factionSwatchHex(key: string): string {
  const k = key as PondsteadFactionColorKey;
  return SWATCH_HEX[k] ?? "#718096";
}

type PickerProps = {
  value: string;
  onChange: (key: string) => void;
  /** Lowercase faction keys already claimed in the lobby */
  taken?: ReadonlySet<string>;
  disabled?: boolean;
  /** Accessible label for the group */
  "aria-label"?: string;
};

export function PondsteadFactionColorPicker({
  value,
  onChange,
  taken,
  disabled = false,
  "aria-label": ariaLabel = "Faction color",
}: PickerProps) {
  const v = value.trim().toLowerCase();
  return (
    <HStack
      role="group"
      gap="3"
      flexWrap="wrap"
      alignItems="center"
      aria-label={ariaLabel}
    >
      {PONDSTEAD_FACTION_COLORS.map((c) => {
        const isTaken = taken?.has(c) ?? false;
        const selected = v === c;
        return (
          <Box key={c} position="relative" display="inline-flex" flexDirection="column" alignItems="center" gap="1">
            <Button
              type="button"
              variant="plain"
              disabled={disabled || isTaken}
              onClick={() => {
                if (!isTaken && !disabled) onChange(c);
              }}
              w="11"
              h="11"
              minW="11"
              p="0"
              borderRadius="md"
              bg={SWATCH_HEX[c]}
              flexShrink={0}
              cursor={disabled || isTaken ? "not-allowed" : "pointer"}
              opacity={isTaken ? 0.38 : 1}
              outline={selected ? "3px solid" : "2px solid"}
              outlineColor={selected ? "fg" : "border"}
              outlineOffset="2px"
              transition="outline-color 0.12s ease, transform 0.12s ease"
              _hover={
                disabled || isTaken
                  ? undefined
                  : { transform: "scale(1.06)", outlineColor: "fg.muted" }
              }
              _focusVisible={{ outlineWidth: "3px", outlineColor: "fg" }}
              title={isTaken ? `${c} (taken)` : c}
              aria-label={isTaken ? `${c}, taken` : c}
              aria-pressed={selected}
            />
            {isTaken ? (
              <Text fontSize="10px" color="fg.muted" lineHeight="1" textAlign="center">
                taken
              </Text>
            ) : null}
          </Box>
        );
      })}
    </HStack>
  );
}
