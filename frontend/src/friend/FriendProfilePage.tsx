import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import { fetchPublicAchievementsByUser, fetchPublicAchievementsByUserId } from "../achievements/api";
import type { AchievementSummary } from "../achievements/types";
import {
  fetchPublicUserSummaryByEmail,
  fetchPublicUserSummaryById,
  friendProfileHeading,
  type PublicUserSummary,
} from "./publicUser";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import { fetchPublicQuotesByUser, fetchPublicQuotesByUserId } from "../quotes/api";
import { quoteOwnerDisplayLabel } from "../quotes/ownerDisplay";
import QuoteCardBase from "../quotes/QuoteCardBase";
import type { Quote } from "../quotes/types";

const PAGE_SIZE = 10;

function FriendProfileQuoteCard({ quote }: { quote: Quote }) {
  return (
    <QuoteCardBase
      quote={quote}
      ownerText={quoteOwnerDisplayLabel(quote.owner)}
      ownerProfileUserId={quote.owner.id}
    />
  );
}

export default function FriendProfilePage() {
  const { userId, email } = useParams<{ userId?: string; email?: string }>();
  const { isAuthenticated, getApiAccessToken } = useAppSession();

  const lookup = useMemo(() => {
    if (userId !== undefined && userId !== "") {
      const id = Number.parseInt(userId, 10);
      if (!Number.isFinite(id) || id < 1) {
        return { kind: "invalid" as const };
      }
      return { kind: "id" as const, id };
    }
    if (email) {
      return { kind: "email" as const, email: decodeURIComponent(email) };
    }
    return { kind: "invalid" as const };
  }, [userId, email]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [achievements, setAchievements] = useState<AchievementSummary[]>([]);
  const [summary, setSummary] = useState<PublicUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (lookup.kind === "invalid") {
      setError("Missing or invalid friend profile in the URL.");
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let accessToken: string | null = null;
        if (isAuthenticated) {
          try {
            accessToken = await getApiAccessToken();
          } catch {
            accessToken = null;
          }
        }
        const [quoteData, achData, summaryData] = await Promise.all([
          lookup.kind === "id"
            ? fetchPublicQuotesByUserId(lookup.id, accessToken)
            : fetchPublicQuotesByUser(lookup.email, accessToken),
          (lookup.kind === "id"
            ? fetchPublicAchievementsByUserId(lookup.id)
            : fetchPublicAchievementsByUser(lookup.email)
          ).catch(() => [] as AchievementSummary[]),
          lookup.kind === "id"
            ? fetchPublicUserSummaryById(lookup.id)
            : fetchPublicUserSummaryByEmail(lookup.email),
        ]);
        const sorted = [...quoteData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setQuotes(sorted);
        setAchievements(achData);
        setSummary(summaryData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load friend profile");
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [lookup, isAuthenticated, getApiAccessToken]);

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
          {summary ? friendProfileHeading(summary) : "Friend profile"}
        </Heading>
        {summary ? (
          <Text fontSize={APP_TEXT_SIZES.helper} mt="1" color="fg.muted">
            {summary.email}
          </Text>
        ) : null}
      </Box>

      <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
        <Stack gap="3" maxW="3xl">
          {isLoading ? <Text>Loading…</Text> : null}
          {error ? <Text role="alert">{error}</Text> : null}
          {!isLoading && !error && achievements.length > 0 ? (
            <Box
              bg="bg"
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              p={{ base: "4", md: "4" }}
            >
              <Heading size="sm" mb="2">
                Achievements
              </Heading>
              <Stack gap="3">
                {achievements.map((a) => (
                  <Stack key={a.slug} gap="0">
                    <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                      {a.title}
                    </Text>
                    {a.description ? (
                      <Text fontSize={APP_TEXT_SIZES.helper}>{a.description}</Text>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            </Box>
          ) : null}
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
            <FriendProfileQuoteCard key={quote.id} quote={quote} />
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
