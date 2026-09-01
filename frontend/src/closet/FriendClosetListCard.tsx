import { Box, HStack, Stack, Tag, Text } from "@chakra-ui/react";
import PresignedImage from "../lib/PresignedImage";
import { Link as RouterLink } from "react-router";
import { MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import type { ClosetItem } from "./types";
import { displayName, itemIsLoanedOut } from "./closetUtils";

export type FriendClosetListCardProps = {
  item: ClosetItem;
  closetReturnTo: string;
};

/** Desktop card height — matches `/books` list cards so paginated grids stay even. */
const CLOSET_LIST_CARD_DESKTOP_H = "7rem";

/**
 * Compact cover + title row for friends’ closet grids (Community Closet + friend profile),
 * styled like the `/books` list cards.
 */
export function FriendClosetListCard({ item, closetReturnTo }: FriendClosetListCardProps) {
  const imageUrl = (item.image_url ?? "").trim();
  const ownerLabel = displayName(item.owner_user);
  const loaned = itemIsLoanedOut(item);

  return (
    <RouterLink
      to={`/closet?tab=items&item=${item.id}`}
      state={{ closetReturnTo }}
      aria-label={`Open item: ${item.name}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        height: "100%",
        minHeight: 0,
      }}
    >
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        borderRadius="xl"
        w="100%"
        minW={0}
        h={{ md: CLOSET_LIST_CARD_DESKTOP_H }}
        minH={{ md: CLOSET_LIST_CARD_DESKTOP_H }}
        overflow={{ md: "hidden" }}
        {...MAPPED_LIST_CARD_OUTER_PROPS}
        _hover={{ borderColor: "teal.solid" }}
      >
        <HStack align="stretch" gap="2" w="100%" h="100%">
          {imageUrl ? (
            <PresignedImage
              src={imageUrl}
              alt=""
              w="56px"
              h="84px"
              objectFit="cover"
              objectPosition="center"
              borderRadius="md"
              flexShrink={0}
              draggable={false}
            />
          ) : (
            <Box
              w="56px"
              h="84px"
              bg="bg.muted"
              borderRadius="md"
              flexShrink={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="lg" fontWeight="bold" color="gray.400" userSelect="none">
                {(item.name.trim().slice(0, 1) || "?").toUpperCase()}
              </Text>
            </Box>
          )}
          <Stack gap="1" minW={0} flex="1" justify="space-between">
            <Stack gap="1" minW={0}>
              <HStack align="start" justify="space-between" gap="2" w="100%">
                <Text fontWeight="semibold" fontSize="sm" lineClamp={2} minW={0} flex="1">
                  {item.name}
                </Text>
                {loaned ? (
                  <Tag.Root
                    size="sm"
                    bg="orange.solid"
                    color="white"
                    borderWidth="0"
                    flexShrink={0}
                  >
                    <Tag.Label fontWeight="bold">LOANED</Tag.Label>
                  </Tag.Root>
                ) : null}
              </HStack>
              <Text color="fg.muted" fontSize={{ base: "2xs", md: "xs" }} lineClamp={1}>
                Owned by {ownerLabel}
              </Text>
            </Stack>
          </Stack>
        </HStack>
      </Box>
    </RouterLink>
  );
}
