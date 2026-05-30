import { Box, Text } from "@chakra-ui/react";
import { SQUALLS_HUD_COLORS } from "../../squallsTheme";

export const DM_PANEL_CARD_PROPS = {
  p: 3,
  borderWidth: "1px",
  borderColor: SQUALLS_HUD_COLORS.panelBorder,
  borderRadius: "md",
  bg: "rgba(0, 0, 0, 0.22)",
} as const;

export function DmStatRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text
        fontSize="xs"
        color={SQUALLS_HUD_COLORS.panelSubtle}
        textTransform="uppercase"
        letterSpacing="wide"
      >
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" color={SQUALLS_HUD_COLORS.panelText}>
        {value}
      </Text>
    </Box>
  );
}

export function DmSectionHeading({ children }: { children: string }) {
  return (
    <Text fontSize="md" fontWeight="bold" color={SQUALLS_HUD_COLORS.panelText} mt={2}>
      {children}
    </Text>
  );
}

export function DmPanelIntro({ children }: { children: string }) {
  return (
    <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted}>
      {children}
    </Text>
  );
}
