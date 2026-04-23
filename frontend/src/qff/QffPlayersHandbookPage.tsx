import { Box, Flex, HStack, Heading, Tabs, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import { QFF_MAIN_CONTENT_PROPS } from "./qffUi";

export default function QffPlayersHandbookPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading } = useAppSession();
  const approved = !!sessionUser?.user?.is_approved;

  if (!isLoading && !isAuthenticated) {
    return (
      <Box {...QFF_MAIN_CONTENT_PROPS} py={8} color="#c8e6a8">
        <Text>Sign in to read the Player&apos;s Handbook.</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box {...QFF_MAIN_CONTENT_PROPS} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!approved) {
    return (
      <Box {...QFF_MAIN_CONTENT_PROPS} py={8} color="#c8e6a8">
        <Text color="nautical.solid">Your account must be approved to view this page.</Text>
        <QffButton type="button" onClick={() => navigate("/qff")} mt={4}>
          ← Back to lobby
        </QffButton>
      </Box>
    );
  }

  return (
    <Box {...QFF_MAIN_CONTENT_PROPS} py={8} color="#c8e6a8">
      <Flex
        flexWrap="wrap"
        align="center"
        justify="space-between"
        gap={3}
        mb={4}
        columnGap={4}
      >
        <Heading size="lg" color="#e8f5c8" letterSpacing="wide">
          Player&apos;s Handbook
        </Heading>
        <HStack display="inline-flex" gap={2} flexWrap="wrap" justify="flex-end">
          <QffButton type="button" size="sm" onClick={() => navigate("/qff")}>
            Back to lobby
          </QffButton>
          <QffButton type="button" size="sm" onClick={() => navigate("/qff/play")}>
            Start playing
          </QffButton>
        </HStack>
      </Flex>

      <Text fontSize="sm" color="#889977" mb={6} fontStyle="italic">
        Rules, classes, and reference — more soon.
      </Text>

      <Tabs.Root defaultValue="overview" variant="line" colorPalette="green">
        <Tabs.List
          borderColor="whiteAlpha.300"
          css={{
            "& [role='tab']": { color: "#ffffff" },
            "& [role='tab'][data-state='inactive']": { color: "#ffffff" },
            "& [role='tab'][data-state='active']": { color: "#ffffff" },
          }}
        >
          <Tabs.Trigger value="overview" px={3} color="white">
            Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="classes" px={3} color="white">
            Classes
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview" py={4}>
          <Text color="#a8b898" lineHeight="tall">
            Overview content will go here — setting expectations, how to play, and links to deeper
            topics.
          </Text>
        </Tabs.Content>
        <Tabs.Content value="classes" py={4}>
          <Text color="#a8b898" lineHeight="tall">
            Class summaries, starter gear, and priority stats will go here. For now this is a
            placeholder; see your DM for full class data.
          </Text>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
