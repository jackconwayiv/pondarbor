import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PondButton from "../PondButton";
import { fetchPublicQuotesByUser } from "./api";
import type { Quote } from "./types";

const PAGE_SIZE = 10;

function PublicUserQuoteCard({ quote }: { quote: Quote }) {
  const labels = useMemo(
    () => quote.labels.map((l) => `${l.kind}: ${l.name}`).join(" • "),
    [quote.labels],
  );

  return (
    <Box borderWidth="1px" borderColor="border" p="4" borderRadius="md">
      <Stack gap="2">
        <Text whiteSpace="pre-wrap">{quote.body}</Text>
        <Text textStyle="sm">Captured: {new Date(quote.created_at).toLocaleString()}</Text>
        {labels ? <Text textStyle="sm">Labels: {labels}</Text> : null}
      </Stack>
    </Box>
  );
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
    <Stack gap="6" maxW="3xl">
      <Heading size="lg">Public Quotes by {email ?? "Unknown User"}</Heading>
      {isLoading ? <Text>Loading…</Text> : null}
      {error ? <Text role="alert">{error}</Text> : null}
      {!isLoading && !error && quotes.length === 0 ? <Text>No public quotes found.</Text> : null}
      {visibleQuotes.map((quote) => (
        <PublicUserQuoteCard key={quote.id} quote={quote} />
      ))}
      {total > PAGE_SIZE ? (
        <Stack gap="2">
          <Text textStyle="sm">
            Showing {startIndex + 1}-{endIndex} of {total}
          </Text>
          <Stack direction="row" align="center">
            <PondButton
              type="button"
              size="sm"
              colorPalette="nautical"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              ←
            </PondButton>
            <Text textStyle="sm">
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
      ) : null}
    </Stack>
  );
}

