import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import { fetchPublicQuotesByUser } from "./api";
import QuoteCardBase from "./QuoteCardBase";
import type { Quote } from "./types";

const PAGE_SIZE = 10;

function PublicUserQuoteCard({ quote }: { quote: Quote }) {
  return <QuoteCardBase quote={quote} ownerText={quote.owner.email} />;
}

export default function PublicUserQuotesPage() {
  const { email } = useParams<{ email: string }>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (!email) {
      setError("Missing user email in route.");
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchPublicQuotesByUser(email);
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setQuotes(sorted);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load user public quotes");
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [email]);

  const total = quotes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);
  const visibleQuotes = quotes.slice(startIndex, endIndex);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box bg="bg" px={{ base: "4", md: "6" }} py={{ base: "6", md: "6" }}>
        <Heading size="lg" maxW="3xl">
          Public quotes by {email ?? "Unknown user"}
        </Heading>
      </Box>

      <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
        <Stack gap="3" maxW="3xl">
          {isLoading ? <Text>Loading…</Text> : null}
          {error ? <Text role="alert">{error}</Text> : null}
          {!isLoading && !error && quotes.length === 0 ? (
            <Text>No public quotes found.</Text>
          ) : null}
          {total > PAGE_SIZE && visibleQuotes.length === PAGE_SIZE ? (
            <Box
              bg="bg"
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              p={{ base: "4", md: "4" }}
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
            <PublicUserQuoteCard key={quote.id} quote={quote} />
          ))}
          {total > PAGE_SIZE ? (
            <Box
              bg="bg"
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              p={{ base: "4", md: "4" }}
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
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                  >
                    →
                  </PondButton>
                </Stack>
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}
