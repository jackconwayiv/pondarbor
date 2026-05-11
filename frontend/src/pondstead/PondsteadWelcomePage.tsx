import { Box, Heading, Link, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

const ABOUT =
  "Pondstead is a slow-paced strategy map for two (soon up to six) players: expand from your HQ, harvest food and materials, recruit units, build structures, and race to the victory score. Each real-world morning (after 3:00 America/Phoenix) the calendar may advance for everyone in a campaign, with results summarized in your Daily Report. Undo rewinds only your own actions for the current in-game day.";

export default function PondsteadWelcomePage() {
  const { isAuthenticated } = useAppSession();

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Heading
          as="h1"
          size={{ base: "lg", md: "xl" }}
          mb="2"
        >
          Pondstead
        </Heading>
        <Text
          fontSize={APP_TEXT_SIZES.body}
          lineHeight="tall"
          color="fg"
        >
          {ABOUT}
        </Text>
      </Box>

      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Text
          fontWeight="semibold"
          fontSize={APP_TEXT_SIZES.label}
          color="fg"
          mb="3"
        >
          Play with friends
        </Text>
        <PondButton asChild colorPalette="teal" size="md">
          <RouterLink to={isAuthenticated ? "/pondstead/campaigns" : "/"}>
            {isAuthenticated ? "My campaigns" : "Log in to play"}
          </RouterLink>
        </PondButton>
        {isAuthenticated ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="3">
            Create a lobby, invite approved players, then start when seats are full.
          </Text>
        ) : (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="3">
            Sign in from the home page, then return here to open your campaigns.
          </Text>
        )}
      </Box>

      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        <Link asChild variant="underline" color="fg.muted">
          <RouterLink to="/games">← All games</RouterLink>
        </Link>
      </Text>
    </Stack>
  );
}
