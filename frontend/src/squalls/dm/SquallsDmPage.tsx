import { useAuth0 } from "@auth0/auth0-react";
import { Box, Heading, Stack, Tabs, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../../auth/auth0LoginParams";
import PondButton from "../../PondButton";
import { fullBleedStackProps } from "../../responsive";
import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../../theme/appShellTabs";
import { APP_SHELL_TRAY_PROPS } from "../../theme/typography";
import DmCardsPanel from "./panels/DmCardsPanel";
import DmEquipmentPanel from "./panels/DmEquipmentPanel";
import DmEventsPanel from "./panels/DmEventsPanel";
import DmItemsPanel from "./panels/DmItemsPanel";
import DmMonstersPanel from "./panels/DmMonstersPanel";
import DmRulesPanel from "./panels/DmRulesPanel";

type DmTab = "items" | "equipment" | "monsters" | "events" | "cards" | "rules";

export default function SquallsDmPage() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, sessionUser, isLoading } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [tab, setTab] = useState<DmTab>("items");

  if (isLoading) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8}>
        <Text color="gray.900">Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8}>
        <Heading size="md" mb={3} color="gray.900">
          Squalls DM Reference
        </Heading>
        <Text color="gray.900" mb={4}>
          Sign in with a staff account to view the game catalog.
        </Text>
        <PondButton
          onClick={() =>
            loginWithRedirect({
              authorizationParams: auth0LoginAuthorizationParams(),
            })
          }
        >
          Sign in
        </PondButton>
      </Box>
    );
  }

  if (!isStaff) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8}>
        <Heading size="md" mb={3} color="gray.900">
          Squalls DM Reference
        </Heading>
        <Text color="gray.900">Staff only.</Text>
      </Box>
    );
  }

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            <Box>
              <Heading size="lg" color="gray.900">
                Squalls DM Reference
              </Heading>
              <Text fontSize="sm" color="gray.900" mt={1}>
                Read-only catalog of items, monsters, events, cards, and rules.
              </Text>
              <Text fontSize="sm" mt={2}>
                <RouterLink to="/squalls" style={{ color: "inherit" }}>
                  ← Back to Squalls & Shanties
                </RouterLink>
              </Text>
            </Box>

            <Tabs.Root
              value={tab}
              onValueChange={(details) => setTab(details.value as DmTab)}
            >
              <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
                <Tabs.Trigger value="items" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Items
                </Tabs.Trigger>
                <Tabs.Trigger value="equipment" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Equipment
                </Tabs.Trigger>
                <Tabs.Trigger value="monsters" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Monsters
                </Tabs.Trigger>
                <Tabs.Trigger value="events" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Events
                </Tabs.Trigger>
                <Tabs.Trigger value="cards" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Cards
                </Tabs.Trigger>
                <Tabs.Trigger value="rules" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Rules
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="items" pt={4}>
                <DmItemsPanel />
              </Tabs.Content>
              <Tabs.Content value="equipment" pt={4}>
                <DmEquipmentPanel />
              </Tabs.Content>
              <Tabs.Content value="monsters" pt={4}>
                <DmMonstersPanel />
              </Tabs.Content>
              <Tabs.Content value="events" pt={4}>
                <DmEventsPanel />
              </Tabs.Content>
              <Tabs.Content value="cards" pt={4}>
                <DmCardsPanel />
              </Tabs.Content>
              <Tabs.Content value="rules" pt={4}>
                <DmRulesPanel />
              </Tabs.Content>
            </Tabs.Root>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
