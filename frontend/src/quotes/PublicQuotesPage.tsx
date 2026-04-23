import { Box, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelListRowSkeleton,
  PanelMessageSlot,
} from "../components/panelStatus";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_LIST_CARD_OUTER_PROPS,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchPublishedQuotes } from "./api";
import { quoteOwnerDisplayLabel } from "./ownerDisplay";
import QuoteCardBase from "./QuoteCardBase";
import type { Quote } from "./types";

const PAGE_SIZE = 10;

function PublicQuoteCard({ quote }: { quote: Quote }) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      {...MAPPED_LIST_CARD_OUTER_PROPS}
    >
      <QuoteCardBase
        quote={quote}
        ownerText={quoteOwnerDisplayLabel(quote.owner)}
        ownerProfileUserId={quote.owner.id}
      />
    </Box>
  );
}

export default function PublicQuotesPage() {
  const { getApiAccessToken, sessionUser } = useAppSession();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const run = async () => {
      if (!sessionUser?.user?.is_approved) {
        setQuotes([]);
        setError(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const token = await getApiAccessToken();
        const data = await fetchPublishedQuotes(token);
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setQuotes(sorted);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load published quotes",
        );
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [getApiAccessToken, sessionUser?.user?.is_approved]);

  const total = quotes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);
  const visibleQuotes = quotes.slice(startIndex, endIndex);

  return (
    <Stack gap={MAPPED_LIST_STACK_GAP} w="100%">
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        {isLoading ? (
          <PanelListRowSkeleton rows={2} />
        ) : (
          <PanelMessageSlot error={error} />
        )}
      </Box>
      {!isLoading && !error && quotes.length === 0 ? (
        <Text>No published quotes yet.</Text>
      ) : null}
      {total > PAGE_SIZE && visibleQuotes.length === PAGE_SIZE ? (
        <Box
          bg="bg"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          p={{ base: "2", md: "2" }}
        >
          <Stack gap="2">
            <Text fontSize={APP_TEXT_SIZES.helper}>
              Showing {startIndex + 1}-{endIndex} of {total}
            </Text>
            <Stack direction="row" align="center" flexWrap="wrap" gap="3">
              <PondButton
                type="button"
                size="sm"
                colorPalette="nautical"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                ←
              </PondButton>
              <Text fontSize={APP_TEXT_SIZES.helper}>
                Page {safePage + 1} / {totalPages}
              </Text>
              <PondButton
                type="button"
                size="sm"
                colorPalette="nautical"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={safePage >= totalPages - 1}
              >
                →
              </PondButton>
            </Stack>
          </Stack>
        </Box>
      ) : null}
      {visibleQuotes.map((quote) => (
        <PublicQuoteCard key={quote.id} quote={quote} />
      ))}
      {total > PAGE_SIZE ? (
        <Box
          bg="bg"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          p={{ base: "2", md: "2" }}
        >
          <Stack gap="2">
            <Text fontSize={APP_TEXT_SIZES.helper}>
              Showing {startIndex + 1}-{endIndex} of {total}
            </Text>
            <Stack direction="row" align="center" flexWrap="wrap" gap="3">
              <PondButton
                type="button"
                size="sm"
                colorPalette="nautical"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                ←
              </PondButton>
              <Text fontSize={APP_TEXT_SIZES.helper}>
                Page {safePage + 1} / {totalPages}
              </Text>
              <PondButton
                type="button"
                size="sm"
                colorPalette="nautical"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={safePage >= totalPages - 1}
              >
                →
              </PondButton>
            </Stack>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
