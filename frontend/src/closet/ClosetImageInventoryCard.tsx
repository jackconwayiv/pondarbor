import { Box, Card, HStack, Stack, Tag, Text } from "@chakra-ui/react";
import PresignedImage from "../lib/PresignedImage";
import type { MouseEvent } from "react";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { ClosetImageInventoryRow } from "./types";

function usageSummaryLine(row: ClosetImageInventoryRow): string {
  const nItems = row.attached_live_item_count;
  const nMeals = row.attached_meal_count ?? 0;
  const nPeople = row.attached_person_count ?? 0;
  const parts: string[] = [];
  if (nItems > 0) {
    parts.push(`${nItems} live item${nItems === 1 ? "" : "s"}`);
  }
  if (nMeals > 0) {
    parts.push(`${nMeals} recipe${nMeals === 1 ? "" : "s"}`);
  }
  if (nPeople > 0) {
    parts.push(`${nPeople} family tree ${nPeople === 1 ? "person" : "people"}`);
  }
  if (row.attached_as_avatar) {
    parts.push("your avatar");
  }
  if (parts.length === 0) {
    return "Not used by items, recipes, family tree, or avatar";
  }
  return `Used by: ${parts.join(", ")}`;
}

export type ClosetImageInventoryCardProps = {
  row: ClosetImageInventoryRow;
  deletingImageKey: string | null;
  confirmDeleteImageKey: string | null;
  onDeleteClick: (e: MouseEvent) => void;
  deleteButtonRef: (el: HTMLButtonElement | null) => void;
  getApiAccessToken: () => Promise<string>;
};

/**
 * Square thumbnail + compact footer, styled like {@link FriendClosetListCard} — image-forward for Image Manager.
 */
export function ClosetImageInventoryCard({
  row,
  deletingImageKey,
  confirmDeleteImageKey,
  onDeleteClick,
  deleteButtonRef,
  getApiAccessToken,
}: ClosetImageInventoryCardProps) {
  const summary = usageSummaryLine(row);
  const stranded = row.status === "stranded";

  return (
    <Card.Root
      flexDirection="column"
      overflow="hidden"
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      p="0"
      h="100%"
      minH={0}
      _hover={{ borderColor: "teal.solid" }}
    >
      <Box
        position="relative"
        w="100%"
        aspectRatio={1}
        bg="bg.subtle"
        overflow="hidden"
      >
        {row.image_url ? (
          <PresignedImage
            src={row.image_url}
            imageKey={row.image_key}
            getApiAccessToken={getApiAccessToken}
            alt=""
            w="100%"
            h="100%"
            objectFit="cover"
            objectPosition="center"
            draggable={false}
          />
        ) : (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="100%"
            h="100%"
          >
            <Text fontSize="4xl" fontWeight="bold" color="gray.400" userSelect="none">
              ?
            </Text>
          </Box>
        )}
        {stranded ? (
          <Tag.Root
            position="absolute"
            top="2"
            right="2"
            size="sm"
            bg="orange.solid"
            color="white"
            borderWidth="0"
          >
            <Tag.Label fontWeight="bold">STRANDED</Tag.Label>
          </Tag.Root>
        ) : null}
      </Box>

      <Stack gap="1.5" px="3" py="2" borderTopWidth="1px" borderColor="white" bg="white" flexShrink={0}>
        <HStack justify="space-between" align="flex-start" gap="2" flexWrap="wrap" w="100%">
          <Text fontWeight="semibold" fontSize="sm" lineClamp={2}>
            {stranded ? "Stranded" : "Attached"}
          </Text>
          <PondButton
            ref={deleteButtonRef}
            size="sm"
            colorPalette="nautical"
            flexShrink={0}
            loading={deletingImageKey === row.image_key}
            disabled={deletingImageKey !== null}
            onClick={onDeleteClick}
          >
            {confirmDeleteImageKey === row.image_key ? "Confirm delete" : "Delete"}
          </PondButton>
        </HStack>
        <Text fontSize="xs" color="fg.muted" lineClamp={3}>
          {summary}
        </Text>
        {!row.present_in_bucket ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
            Missing from bucket
          </Text>
        ) : null}
        <Text
          fontSize="xs"
          color="fg.muted"
          wordBreak="break-all"
          lineClamp={2}
          title={row.image_key}
        >
          {row.image_key}
        </Text>
      </Stack>
    </Card.Root>
  );
}
