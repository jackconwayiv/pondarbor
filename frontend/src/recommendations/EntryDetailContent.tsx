import { Box, Card, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ClosetItemModalTopNav,
  type ClosetItemModalNav,
} from "../closet/ClosetItemModalFooter";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import EntryReviewList from "./EntryReviewList";
import StarRatingDisplay, { ReviewerAvatarRow } from "./StarRatingDisplay";
import WriteReviewModal from "./WriteReviewModal";
import { formatEntrySecondaryLine } from "./utils";
import type { RecommendationEntry } from "./types";

export type EntryDetailContentProps = {
  entry: RecommendationEntry;
  entryNav?: ClosetItemModalNav | null;
  mergeNotice?: string | null;
  onReload: () => void | Promise<void>;
};

export default function EntryDetailContent({
  entry,
  entryNav,
  mergeNotice,
  onReload,
}: EntryDetailContentProps) {
  const navigate = useNavigate();
  const { sessionUser } = useAppSession();
  const [writeReviewOpen, setWriteReviewOpen] = useState(false);

  const slug = entry.category.slug;
  const secondaryLine = formatEntrySecondaryLine(entry);
  const hasHeroImage = Boolean(entry.image_url?.trim());
  const viewerReviewId = entry.viewer_review_id;
  const isOwner = entry.created_by.id === sessionUser?.user.id;

  return (
    <Stack gap="2" w="100%">
      {mergeNotice ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="lilypad.solid" role="status">
          {mergeNotice}
        </Text>
      ) : null}

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="4" w="100%">
            {entryNav ? <ClosetItemModalTopNav itemNav={entryNav} /> : null}

            {hasHeroImage ? (
              <Box
                w="100%"
                minH={{ base: "min(48vh, 400px)", md: "min(45vh, 480px)" }}
                maxH="70vh"
                bg="bg.subtle"
                borderRadius="md"
                overflow="hidden"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <img
                  src={entry.image_url}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "center",
                  }}
                />
              </Box>
            ) : null}

            <Stack gap="2">
              <HStack align="flex-start" gap="3" flexWrap="wrap">
                <Text fontSize="xl" aria-hidden flexShrink={0} lineHeight="short">
                  {entry.category.emoji}
                </Text>
                <Stack gap="1" flex="1" minW="0">
                  <Text fontSize={APP_TEXT_SIZES.title} fontWeight="semibold" lineHeight="short">
                    {entry.title}
                  </Text>
                  {secondaryLine ? (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      {secondaryLine}
                    </Text>
                  ) : null}
                  {entry.category.group === "places" &&
                  entry.address &&
                  entry.address !== secondaryLine ? (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      {entry.address}
                    </Text>
                  ) : null}
                </Stack>
              </HStack>

              {entry.link ? (
                <Link
                  href={entry.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="sky.solid"
                  fontSize={APP_TEXT_SIZES.helper}
                >
                  Visit link
                </Link>
              ) : null}

              <HStack gap={2} align="center" flexWrap="wrap">
                <StarRatingDisplay rating={entry.average_rating} count={entry.review_count} />
                <ReviewerAvatarRow reviewers={entry.reviewer_avatars} />
              </HStack>

              <HStack gap="3" flexWrap="wrap">
                {viewerReviewId ? (
                  <PondButton
                    size="sm"
                    variant="outline"
                    colorPalette="sky"
                    onClick={() => navigate(`/recommendations/${slug}/${entry.id}/edit`)}
                  >
                    Edit your review
                  </PondButton>
                ) : (
                  <PondButton size="sm" colorPalette="sky" onClick={() => setWriteReviewOpen(true)}>
                    Write a review
                  </PondButton>
                )}
                {isOwner ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    You created this entry.
                  </Text>
                ) : null}
              </HStack>
            </Stack>

            <Stack gap="2">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold">
                Reviews
              </Text>
              <EntryReviewList reviews={entry.reviews ?? []} />
            </Stack>
          </Stack>
        </Card.Body>
      </Card.Root>

      <WriteReviewModal
        open={writeReviewOpen}
        onOpenChange={setWriteReviewOpen}
        entryId={entry.id}
        entryTitle={entry.title}
        onSuccess={() => void onReload()}
      />
    </Stack>
  );
}
