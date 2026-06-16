import { Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelEmptyState,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { fetchCategoryEntries } from "./api";
import { groupLabel } from "./categoryGroups";
import EntryListCard from "./EntryListCard";
import RecommendationsEntryModal from "./RecommendationsEntryModal";
import { useRecommendationsAdd } from "./recommendationsAddContext";
import { useRecommendationEntryModal } from "./useRecommendationEntryModal";
import type { RecommendationEntry } from "./types";

export default function RecommendationsCategoryPage() {
  const { categorySlug = "" } = useParams();
  const { openAddModal } = useRecommendationsAdd();
  const { getApiAccessToken, isLoading, error: sessionError, refreshSession } = useAppSession();
  const [entries, setEntries] = useState<RecommendationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!categorySlug) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      setEntries(await fetchCategoryEntries(token, categorySlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }, [categorySlug, getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryName = useMemo(
    () => entries[0]?.category.name ?? categorySlug.replace(/-/g, " "),
    [entries, categorySlug],
  );
  const categoryGroup = entries[0]?.category.group;

  const withLocation = entries.filter((e) => e.location_label.trim());
  const withoutLocation = entries.filter((e) => !e.location_label.trim());
  const orderedEntries = useMemo(
    () => [...withLocation, ...withoutLocation],
    [withLocation, withoutLocation],
  );

  const { selectedEntryId, entryQueryInvalid, entryModalNav, closeExpanded } =
    useRecommendationEntryModal(orderedEntries);

  if (isLoading) return <SessionLoadingCard />;
  if (sessionError) return <PanelSessionReconnect sessionError={sessionError} onRetry={() => void refreshSession()} />;

  return (
    <Stack gap={6} maxW="4xl" mx="auto">
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <Stack gap={1}>
          <RouterLink to="/recommendations">
            <PondButton variant="ghost" size="sm">← Categories</PondButton>
          </RouterLink>
          <Heading size="lg" textTransform="capitalize">
            {categoryName}
          </Heading>
          {categoryGroup ? (
            <Text fontSize="sm" color="fg.muted">
              {groupLabel(categoryGroup)}
            </Text>
          ) : null}
        </Stack>
        <PondButton
          onClick={() =>
            openAddModal({
              defaultCategorySlug: categorySlug,
              onSuccess: () => void load(),
            })
          }
        >
          Add recommendation
        </PondButton>
      </HStack>

      {loading ? <SessionLoadingCard /> : null}
      {error ? <Text color="red.500">{error}</Text> : null}

      {!loading && !error && entries.length === 0 ? (
        <PanelEmptyState
          title="No recommendations yet"
          description="Be the first to add one in this category."
        />
      ) : null}

      {!loading && withLocation.length > 0 ? (
        <Stack gap={3}>
          <Heading size="sm">By location</Heading>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
            {withLocation.map((entry) => (
              <EntryListCard key={entry.id} entry={entry} categorySlug={categorySlug} />
            ))}
          </Grid>
        </Stack>
      ) : null}

      {!loading && withoutLocation.length > 0 ? (
        <Stack gap={3}>
          {withLocation.length > 0 ? <Heading size="sm">Recent</Heading> : null}
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
            {withoutLocation.map((entry) => (
              <EntryListCard key={entry.id} entry={entry} categorySlug={categorySlug} />
            ))}
          </Grid>
        </Stack>
      ) : null}

      <RecommendationsEntryModal
        selectedEntryId={selectedEntryId}
        entryQueryInvalid={entryQueryInvalid}
        entryModalNav={entryModalNav}
        onClose={closeExpanded}
        onEntryUpdated={() => void load()}
      />
    </Stack>
  );
}
