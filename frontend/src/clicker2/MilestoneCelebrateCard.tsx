import { Box, Button, CloseButton, Flex, Stack, Text } from "@chakra-ui/react";
import { DESIGN } from "../theme/tokens";
import { milestoneDisplayEmoji, type MilestoneDef } from "./milestones";

import "./MilestoneCelebrateCard.css";

type Props = {
  milestone: MilestoneDef;
  onDismiss: () => void;
  motionPaused?: boolean;
};

export function MilestoneDismissAllCard({
  onDismissAll,
  motionPaused = false,
}: {
  onDismissAll: () => void;
  motionPaused?: boolean;
}) {
  return (
    <Button
      type="button"
      unstyled
      className={`pond2MilestoneCelebrateCard pond2MilestoneDismissAllCard${motionPaused ? " pond2MilestoneCelebrateCard--paused" : ""}`}
      display="flex"
      alignItems="center"
      justifyContent="center"
      alignSelf="stretch"
      minW={0}
      h="100%"
      w="2.25rem"
      flexShrink={0}
      borderRadius="md"
      borderWidth="2px"
      borderColor={DESIGN.nautical}
      bg="nautical.subtle"
      color="gray.700"
      shadow="md"
      cursor="pointer"
      aria-label="Dismiss all milestones"
      _hover={{ bg: "blackAlpha.100" }}
      _active={{ bg: "blackAlpha.200" }}
      onClick={onDismissAll}
    >
      <Text fontSize="xl" lineHeight="1" fontWeight="bold" aria-hidden>
        ×
      </Text>
    </Button>
  );
}

export function MilestoneCelebrateCard({
  milestone,
  onDismiss,
  motionPaused = false,
}: Props) {
  const emoji = milestoneDisplayEmoji(milestone);

  return (
    <Box
      className={`pond2MilestoneCelebrateCard${motionPaused ? " pond2MilestoneCelebrateCard--paused" : ""}`}
      position="relative"
      minW={0}
      h="full"
      borderRadius="md"
      borderWidth="2px"
      borderColor={DESIGN.nautical}
      bg="nautical.subtle"
      color="gray.800"
      px={2.5}
      py={2}
      shadow="md"
    >
      <CloseButton
        position="absolute"
        top={0.5}
        right={0.5}
        size="sm"
        color="gray.700"
        _hover={{ bg: "blackAlpha.100" }}
        onClick={onDismiss}
        aria-label="Dismiss milestone"
      />
      <Stack gap={0.5} pr={5}>
        <Flex gap="1" align="center">
          {emoji ? (
            <Text fontSize="sm" lineHeight="1" aria-hidden flexShrink={0}>
              {emoji}
            </Text>
          ) : null}
          <Text fontWeight="bold" fontSize="sm" lineHeight="1.25">
            {milestone.title}
          </Text>
        </Flex>
        <Text fontSize="xs" color="gray.700" fontStyle="italic" lineHeight="1.35">
          {milestone.description}
        </Text>
      </Stack>
    </Box>
  );
}
