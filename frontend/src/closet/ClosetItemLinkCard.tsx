import { Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import type { ClosetItem } from "./types";

/**
 * Compact list row linking to `/closet/items/:id` (Meal-style list → detail).
 */
export function ClosetItemLinkCard({
  item,
  closetReturnTo,
  titlePrefix,
  subtitle,
  dashedBorder = false,
}: {
  item: ClosetItem;
  closetReturnTo: string;
  titlePrefix?: ReactNode;
  subtitle?: ReactNode;
  dashedBorder?: boolean;
}) {
  const imageUrl = (item.image_url ?? "").trim();

  return (
    <RouterLink
      to={`/closet/items/${item.id}`}
      state={{ closetReturnTo }}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Box
        bg="white"
        borderWidth="1px"
        borderStyle={dashedBorder ? "dashed" : "solid"}
        borderColor="border"
        borderRadius="xl"
        {...MAPPED_LIST_CARD_OUTER_PROPS}
        _hover={{ borderColor: "lilypad.solid" }}
      >
        <HStack align="stretch" gap="3">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              aria-hidden
              w="72px"
              h="72px"
              flexShrink={0}
              objectFit="cover"
              borderRadius="md"
              draggable={false}
            />
          ) : null}
          <Stack gap="1" flex="1" minW={0} py="1">
            <HStack gap="2" flexWrap="wrap" align="flex-start">
              {titlePrefix}
              <Text fontWeight="bold" lineClamp={2}>
                {item.name}
              </Text>
            </HStack>
            {subtitle ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                {subtitle}
              </Text>
            ) : null}
            {item.description ? (
              <Text fontSize={APP_TEXT_SIZES.helper} lineClamp={2} color="fg.muted">
                {item.description}
              </Text>
            ) : null}
          </Stack>
        </HStack>
      </Box>
    </RouterLink>
  );
}
