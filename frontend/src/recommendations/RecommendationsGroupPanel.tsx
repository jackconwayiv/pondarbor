import { Grid, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelEmptyState,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { fetchCategories, fetchGroupEntries } from "./api";
import CategoryFilterToggles, {
  loadEnabledSlugs,
  saveEnabledSlugs,
  setSlugEnabled,
} from "./CategoryFilterToggles";
import { categoriesForGroup, type CategoryGroupId } from "./categoryGroups";
import EntryListCard from "./EntryListCard";
import RecommendationsEntryModal from "./RecommendationsEntryModal";
import RecommendationsPlacesMap from "./RecommendationsPlacesMap";
import { useRecommendationsAdd } from "./recommendationsAddContext";
import { useRecommendationEntryModal } from "./useRecommendationEntryModal";
import type { RecommendationEntry } from "./types";

type RecommendationsGroupPanelProps = {
  groupId: CategoryGroupId;
};

export default function RecommendationsGroupPanel({ groupId }: RecommendationsGroupPanelProps) {
  const { refreshNonce } = useRecommendationsAdd();
  const { getApiAccessToken, isLoading, error: sessionError, refreshSession } = useAppSession();
  const [entries, setEntries] = useState<RecommendationEntry[]>([]);
  const [categories, setCategories] = useState<ReturnType<typeof categoriesForGroup>>([]);
  const [enabledSlugs, setEnabledSlugs] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const [allCategories, groupEntries] = await Promise.all([
        fetchCategories(token),
        fetchGroupEntries(token, groupId),
      ]);
      const groupCats = categoriesForGroup(groupId, allCategories);
      setCategories(groupCats);
      setEntries(groupEntries);
      setEnabledSlugs(loadEnabledSlugs(groupId, groupCats));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, groupId]);

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  const handleCheckedChange = (slug: string, checked: boolean) => {
    setEnabledSlugs((prev) => {
      const next = setSlugEnabled(prev, slug, checked);
      saveEnabledSlugs(groupId, next);
      return next;
    });
  };

  const filteredEntries = useMemo(
    () => entries.filter((e) => enabledSlugs.has(e.category.slug)),
    [entries, enabledSlugs],
  );

  const { selectedEntryId, entryQueryInvalid, entryModalNav, closeExpanded, setSelectedEntryId } =
    useRecommendationEntryModal(filteredEntries);

  if (isLoading) return <SessionLoadingCard />;
  if (sessionError) {
    return (
      <PanelSessionReconnect sessionError={sessionError} onRetry={() => void refreshSession()} />
    );
  }

  return (
    <Stack gap={6}>
      <CategoryFilterToggles
        categories={categories}
        enabledSlugs={enabledSlugs}
        onCheckedChange={handleCheckedChange}
      />

      {groupId === "places" ? (
        <RecommendationsPlacesMap entries={filteredEntries} onEntrySelect={setSelectedEntryId} />
      ) : null}

      {loading ? <SessionLoadingCard /> : null}
      {error ? <Text color="red.500">{error}</Text> : null}

      {!loading && !error && filteredEntries.length === 0 ? (
        <PanelEmptyState
          title={
            entries.length === 0
              ? "No recommendations yet"
              : "No categories selected"
          }
          description={
            entries.length === 0
              ? "Be the first to add one."
              : "Turn on at least one type in Filters to see recommendations."
          }
        />
      ) : null}

      {!loading && filteredEntries.length > 0 ? (
        <Stack gap={3}>
          {groupId === "places" ? <Heading size="sm">All places</Heading> : null}
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
            {filteredEntries.map((entry) => (
              <EntryListCard key={entry.id} entry={entry} />
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
