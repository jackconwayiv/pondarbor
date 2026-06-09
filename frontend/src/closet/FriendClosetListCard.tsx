import { Box, Card, HStack, Stack, Tag, Text } from "@chakra-ui/react";
import PresignedImage from "../lib/PresignedImage";
import { Link as RouterLink } from "react-router";
import type { ClosetItem } from "./types";
import { displayName, itemIsLoanedOut } from "./closetUtils";

export type FriendClosetListCardProps = {
  item: ClosetItem;
  closetReturnTo: string;
};

/**
 * Hero image + thin footer strip for friends’ closet grids (Community Closet + friend profile).
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
      <Card.Root
        flexDirection="column"
        overflow="hidden"
        bg="white"
        borderWidth="1px"
        borderColor="border"
        borderRadius="xl"
        p="0"
        h="100%"
        _hover={{ borderColor: "teal.solid" }}
      >
        <Box
          position="relative"
          flex="1"
          minH={{ base: "140px", md: "220px" }}
          maxH={{ base: "min(50vw, 240px)", md: "280px" }}
          bg="bg.subtle"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {imageUrl ? (
            <PresignedImage
              src={imageUrl}
              alt=""
              w="100%"
              h="100%"
              objectFit="contain"
              objectPosition="center"
              draggable={false}
            />
          ) : (
            <Text fontSize="4xl" fontWeight="bold" color="gray.400" userSelect="none">
              {(item.name.trim().slice(0, 1) || "?").toUpperCase()}
            </Text>
          )}
          {loaned ? (
            <Tag.Root
              position="absolute"
              top="2"
              right="2"
              size="sm"
              bg="orange.solid"
              color="white"
              borderWidth="0"
            >
              <Tag.Label fontWeight="bold">LOANED</Tag.Label>
            </Tag.Root>
          ) : null}
        </Box>
        <HStack
          align="stretch"
          gap="2"
          px="3"
          py="2"
          borderTopWidth="1px"
          borderColor="white"
          bg="white"
          flexShrink={0}
        >
          <Stack gap="0" flex="1" minW={0} align="flex-start">
            <Text fontWeight="semibold" fontSize="sm" lineClamp={2}>
              {item.name}
            </Text>
            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
              Owned by {ownerLabel}
            </Text>
          </Stack>
        </HStack>
      </Card.Root>
    </RouterLink>
  );
}
