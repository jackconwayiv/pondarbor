import { Stack } from "@chakra-ui/react";
import { Outlet } from "react-router";

import { PanelPageShell } from "../components/panelStatus";

const TRAY_INNER_STACK_GAP = { base: "4", md: "4" } as const;
const TRAY_INNER_P = { base: "2", md: "2" } as const;

/**
 * Bordered tray shell for Pondstead hub routes (welcome, campaigns, lobby).
 * Map play stays outside this layout for full-bleed game UI.
 */
export default function PondsteadHubLayout() {
  return (
    <PanelPageShell>
      <Stack gap={TRAY_INNER_STACK_GAP} px={TRAY_INNER_P} pt={TRAY_INNER_P} pb="2">
        <Outlet />
      </Stack>
    </PanelPageShell>
  );
}
