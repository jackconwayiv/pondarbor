import { Box, Button, HStack, Text } from "@chakra-ui/react";

/** Must match backend `FACTION_COLORS` in `backend/pondstead/views.py`. */
export const PONDSTEAD_FACTION_COLORS = ["blue", "red", "green", "yellow", "purple", "orange"] as const;
export type PondsteadFactionColorKey = (typeof PONDSTEAD_FACTION_COLORS)[number];

export type FactionColorTokens = { fill: string; border: string; text: string };

// Light fills intended to work as ownership backgrounds under emoji/icons.
const SWATCH_TOKENS: Record<PondsteadFactionColorKey, FactionColorTokens> = {
  blue: { fill: "#CFE7FF", border: "#6AA9E9", text: "#0B2A4A" },
  red: { fill: "#FFD6D6", border: "#E98A8A", text: "#4A0B0B" },
  green: { fill: "#D7F5E1", border: "#78C996", text: "#0B3B1E" },
  yellow: { fill: "#FFF3C4", border: "#E6C86B", text: "#3B2B00" },
  purple: { fill: "#EAD9FF", border: "#B38AE9", text: "#2B0B4A" },
  orange: { fill: "#FFE2C7", border: "#E9A56A", text: "#4A250B" },
};

const SWATCH_HEX: Record<PondsteadFactionColorKey, string> = Object.fromEntries(
  Object.entries(SWATCH_TOKENS).map(([k, v]) => [k, v.fill]),
) as Record<PondsteadFactionColorKey, string>;

export function factionSwatchHex(key: string): string {
  const k = key as PondsteadFactionColorKey;
  return SWATCH_HEX[k] ?? "#718096";
}

export function factionColorTokens(key: string): FactionColorTokens {
  const k = key as PondsteadFactionColorKey;
  return SWATCH_TOKENS[k] ?? { fill: "#E2E8F0", border: "#A0AEC0", text: "#1A202C" };
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
