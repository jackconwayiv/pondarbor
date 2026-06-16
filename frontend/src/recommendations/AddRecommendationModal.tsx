import {
  Box,
  HStack,
  Input,
  RadioGroup,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  createCategory,
  createEntryWithReview,
  fetchCategories,
  resolveRecommendationLink,
} from "./api";
import CategoryPickStep from "./CategoryPickStep";
import { categoryPickLabel, type CategoryGroupId } from "./categoryGroups";
import LinkUrlInput from "./LinkUrlInput";
import LocationPasteInput from "./LocationPasteInput";
import MediaRecommendationFields from "./MediaRecommendationFields";
import {
  applyMusicResolveTitle,
  getMediaFormConfig,
  linksEntryCanSubmit,
  mediaEntryCanSubmit,
  resolveMediaTitleForSubmit,
} from "./mediaFormConfig";
import { looksLikeMapsLink, parsePinPaste } from "./parsePinPaste";
import StarRatingInput from "./StarRatingInput";
import { formatCoordinateForApi, normalizeRatingInput } from "./utils";
import type { RecommendationCategory, ResolveLinkResult } from "./types";

export type AddRecommendationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategorySlug?: string;
  onSuccess?: () => void;
};

type WizardStep = 1 | 2;

const RESOLVE_DEBOUNCE_MS = 600;

const PLACES_HINTS_TO_HIDE = new Set(["Found this place on the map."]);

const emptyForm = () => ({
  title: "",
  link: "",
  creator: "",
  mediaSource: "",
  sourcePaste: "",
  imageUrl: "",
  address: "",
  body: "",
  rating: 0,
  googlePlaceId: "",
  latitude: null as string | null,
  longitude: null as string | null,
});

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function looksLikeHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

export default function AddRecommendationModal({
  open,
  onOpenChange,
  defaultCategorySlug,
  onSuccess,
}: AddRecommendationModalProps) {
  const { getApiAccessToken } = useAppSession();
  const [step, setStep] = useState<WizardStep>(1);
  const [categories, setCategories] = useState<RecommendationCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherGroup, setOtherGroup] = useState<CategoryGroupId>("media");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [creator, setCreator] = useState("");
  const [mediaSource, setMediaSource] = useState("");
  const [sourcePaste, setSourcePaste] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [address, setAddress] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [latitude, setLatitude] = useState<string | null>(null);
  const [longitude, setLongitude] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  );
  const isPlacesFlow = isOther ? otherGroup === "places" : selectedCategory?.group === "places";
  const isLinksFlow = !isOther && categorySlug === "links";
  const effectiveMediaSlug = isOther ? "other" : categorySlug;
  const mediaForm = useMemo(
    () => (isPlacesFlow ? null : getMediaFormConfig(categorySlug, isOther)),
    [isPlacesFlow, categorySlug, isOther],
  );
  const pinLat = parseCoord(latitude);
  const pinLng = parseCoord(longitude);
  const locationResolved = Boolean(address.trim() || (pinLat !== null && pinLng !== null));
  const linkResolved = Boolean(title.trim() || imageUrl.trim());
  const visibleHints = hints.filter((h) => !PLACES_HINTS_TO_HIDE.has(h));

  const resetSourceFields = useCallback(() => {
    const empty = emptyForm();
    setTitle(empty.title);
    setLink(empty.link);
    setCreator(empty.creator);
    setMediaSource(empty.mediaSource);
    setSourcePaste(empty.sourcePaste);
    setImageUrl(empty.imageUrl);
    setAddress(empty.address);
    setBody(empty.body);
    setRating(empty.rating);
    setGooglePlaceId(empty.googlePlaceId);
    setLatitude(empty.latitude);
    setLongitude(empty.longitude);
    setHints([]);
    setError(null);
    setResolving(false);
  }, []);

  const resetForm = useCallback(() => {
    setStep(1);
    setCategorySlug("");
    setIsOther(false);
    setOtherName("");
    setOtherGroup("media");
    resetSourceFields();
    setMergeMessage(null);
    setSaving(false);
  }, [resetSourceFields]);

  const applyResolveResult = useCallback(
    (result: ResolveLinkResult) => {
      setHints(result.hints);
      if (result.title) {
        if (effectiveMediaSlug === "music") {
          applyMusicResolveTitle(result.title, {
            setCreator: (value) => setCreator((prev) => prev || value),
            setMediaSource: (value) => setMediaSource((prev) => prev || value),
          });
        } else {
          setTitle((prev) => prev || result.title);
        }
      }
      if (result.description && effectiveMediaSlug !== "links") {
        setBody((prev) => prev || result.description.slice(0, 500));
      }
      if (result.image_url) setImageUrl((prev) => prev || result.image_url);
      if (result.address) setAddress((prev) => prev || result.address);
      if (result.google_place_id) setGooglePlaceId((prev) => prev || result.google_place_id);
      if (result.latitude) setLatitude(formatCoordinateForApi(result.latitude));
      if (result.longitude) setLongitude(formatCoordinateForApi(result.longitude));
    },
    [effectiveMediaSlug],
  );

  useEffect(() => {
    if (!open) return;
    resetForm();
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const all = await fetchCategories(token);
        setCategories(all);
        if (defaultCategorySlug) {
          const match = all.find((c) => c.slug === defaultCategorySlug);
          if (match) {
            setOtherGroup(match.group);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load categories.");
      }
    })();
  }, [open, defaultCategorySlug, getApiAccessToken, resetForm]);

  const pickCategory = useCallback(
    (slug: string) => {
      setIsOther(false);
      setCategorySlug(slug);
      resetSourceFields();
      setStep(2);
    },
    [resetSourceFields],
  );

  const pickOther = useCallback(() => {
    setIsOther(true);
    setCategorySlug("");
    setOtherName("");
    setOtherGroup(
      defaultCategorySlug
        ? (categories.find((c) => c.slug === defaultCategorySlug)?.group ?? "media")
        : "media",
    );
    resetSourceFields();
    setStep(2);
  }, [categories, defaultCategorySlug, resetSourceFields]);

  const applyParsedPin = useCallback((parsed: ReturnType<typeof parsePinPaste>, raw: string) => {
    if (!parsed) return;
    setLatitude(formatCoordinateForApi(parsed.lat));
    setLongitude(formatCoordinateForApi(parsed.lng));
    if (parsed.label) setTitle((prev) => prev || parsed.label!);
    if (looksLikeMapsLink(raw)) setLink(raw.trim());
  }, []);

  const onSourcePasteChange = useCallback(
    (value: string) => {
      setSourcePaste(value);
      const parsed = parsePinPaste(value);
      if (parsed) {
        applyParsedPin(parsed, value);
      } else if (!value.trim()) {
        setLatitude(null);
        setLongitude(null);
      }
    },
    [applyParsedPin],
  );

  const resolvePlaceSource = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const parsed = parsePinPaste(trimmed);
      if (parsed) {
        applyParsedPin(parsed, trimmed);
      }

      setResolving(true);
      try {
        const token = await getApiAccessToken();
        applyResolveResult(await resolveRecommendationLink(token, trimmed));
        if (looksLikeMapsLink(trimmed) || looksLikeHttpUrl(trimmed)) {
          setLink(trimmed);
        }
      } catch {
        if (!parsed && !looksLikeHttpUrl(trimmed)) {
          setError("Couldn't look up that location — check the text and try again.");
        } else {
          setHints(["Could not resolve this — fill in the details below."]);
        }
      } finally {
        setResolving(false);
      }
    },
    [applyParsedPin, applyResolveResult, getApiAccessToken],
  );

  const resolveMediaLink = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || !looksLikeHttpUrl(trimmed)) return;

      setResolving(true);
      try {
        const token = await getApiAccessToken();
        applyResolveResult(await resolveRecommendationLink(token, trimmed));
      } catch {
        setHints(["Could not resolve this link — fill in the details below."]);
      } finally {
        setResolving(false);
      }
    },
    [applyResolveResult, getApiAccessToken],
  );

  const debouncedSourcePaste = useDebouncedValue(sourcePaste, RESOLVE_DEBOUNCE_MS);
  const debouncedLink = useDebouncedValue(link, RESOLVE_DEBOUNCE_MS);

  useEffect(() => {
    if (step !== 2 || !isPlacesFlow) return;
    void resolvePlaceSource(debouncedSourcePaste);
  }, [step, isPlacesFlow, debouncedSourcePaste, resolvePlaceSource]);

  useEffect(() => {
    if (step !== 2 || isPlacesFlow) return;
    void resolveMediaLink(debouncedLink);
  }, [step, isPlacesFlow, debouncedLink, resolveMediaLink]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setMergeMessage(null);
    try {
      const token = await getApiAccessToken();
      let slug = categorySlug;
      if (isOther) {
        const name = otherName.trim();
        if (!name) {
          setError("Enter a name for this category.");
          setSaving(false);
          return;
        }
        const created = await createCategory(token, { name, group: otherGroup });
        slug = created.slug;
      }
      const hasCoords = pinLat !== null && pinLng !== null;
      const resolvedTitle = isPlacesFlow || isLinksFlow
        ? title.trim()
        : resolveMediaTitleForSubmit(slug, isOther, { title, creator, mediaSource });
      const result = await createEntryWithReview(token, {
        category_slug: slug,
        title: resolvedTitle,
        link: link.trim() || undefined,
        creator: creator.trim() || undefined,
        media_source: mediaSource.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        address: isPlacesFlow ? address.trim() || undefined : undefined,
        google_place_id: hasCoords || isPlacesFlow ? googlePlaceId.trim() || undefined : undefined,
        latitude: hasCoords ? formatCoordinateForApi(pinLat)! : undefined,
        longitude: hasCoords ? formatCoordinateForApi(pinLng)! : undefined,
        rating: normalizeRatingInput(rating),
        body: body.trim(),
        date_recommended: new Date().toISOString().slice(0, 10),
      });
      if (result.merged && result.message) {
        setMergeMessage(result.message);
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(
    (isOther ? otherName.trim() : categorySlug) &&
      body.trim() &&
      rating >= 1 &&
      (isPlacesFlow
        ? title.trim()
        : isLinksFlow
          ? linksEntryCanSubmit({ title, link })
          : mediaEntryCanSubmit(effectiveMediaSlug, isOther, { title, creator, mediaSource })),
  );

  const step2Heading = isOther
    ? "Other"
    : selectedCategory
      ? `${selectedCategory.emoji ? `${selectedCategory.emoji} ` : ""}${categoryPickLabel(selectedCategory)}`
      : "";

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add recommendation"
      size="lg"
      contentProps={{ maxH: "min(90vh, 48rem)", px: "2", py: "2", gap: "2" }}
      bodyProps={{ overflowY: "auto", maxH: "calc(min(90vh, 48rem) - 5rem)" }}
    >
      <Stack gap={2}>
        {mergeMessage ? (
          <Box bg="orange.50" borderWidth="1px" borderColor="orange.200" borderRadius="md" p={2}>
            <Text fontWeight="semibold">{mergeMessage}</Text>
          </Box>
        ) : null}

        {error ? <Text color="red.500">{error}</Text> : null}

        {step === 1 ? (
          <CategoryPickStep
            categories={categories}
            onPickCategory={pickCategory}
            onPickOther={pickOther}
          />
        ) : (
          <>
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
              {step2Heading ? (
                <Text fontWeight="semibold" fontSize="lg">
                  {step2Heading}
                </Text>
              ) : (
                <Box />
              )}
              <PondButton variant="outline" onClick={() => resetForm()}>
                Back
              </PondButton>
            </HStack>

            {isOther ? (
              <Stack gap={2}>
                <Stack gap={0.5}>
                  <Text fontWeight="medium">Category name</Text>
                  <Input
                    value={otherName}
                    onChange={(e) => setOtherName(e.target.value)}
                    placeholder="e.g. Podcasts, Hikes, Recipes…"
                    autoFocus
                  />
                </Stack>
                <Stack gap={0.5}>
                  <Text fontWeight="medium">Is this a place or media?</Text>
                  <RadioGroup.Root
                    value={otherGroup}
                    colorPalette="sky"
                    onValueChange={(details) => {
                      if (details.value === "places" || details.value === "media") {
                        setOtherGroup(details.value);
                      }
                    }}
                  >
                    <HStack gap={4} flexWrap="wrap" align="flex-start">
                      <RadioGroup.Item value="places">
                        <RadioGroup.ItemHiddenInput />
                        <HStack gap={2} align="center">
                          <RadioGroup.ItemIndicator />
                          <RadioGroup.ItemText fontSize="sm">📍 Place</RadioGroup.ItemText>
                        </HStack>
                      </RadioGroup.Item>
                      <RadioGroup.Item value="media">
                        <RadioGroup.ItemHiddenInput />
                        <HStack gap={2} align="center">
                          <RadioGroup.ItemIndicator />
                          <RadioGroup.ItemText fontSize="sm">🎭 Media</RadioGroup.ItemText>
                        </HStack>
                      </RadioGroup.Item>
                    </HStack>
                  </RadioGroup.Root>
                </Stack>
              </Stack>
            ) : null}

            {isPlacesFlow ? (
              <>
                <LocationPasteInput
                  value={sourcePaste}
                  onChange={onSourcePasteChange}
                  locationResolved={locationResolved}
                  autoFocus={!isOther}
                />

                {resolving ? (
                  <Text fontSize="sm" color="fg.muted">
                    Looking up…
                  </Text>
                ) : null}

                {visibleHints.length > 0 ? (
                  <Stack gap={1}>
                    {visibleHints.map((h) => (
                      <Text key={h} fontSize="sm" color="fg.muted">
                        {h}
                      </Text>
                    ))}
                  </Stack>
                ) : null}

                <Stack gap={0.5}>
                  <Text fontWeight="medium">Title</Text>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </Stack>

                <Stack gap={0.5}>
                  <Text fontWeight="medium">Address</Text>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                  {pinLat !== null && pinLng !== null ? (
                    <HStack gap={2} align="center">
                      <Text
                        color="green.500"
                        fontSize="lg"
                        lineHeight="1"
                        aria-label="Location found"
                      >
                        ✓
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        Coordinates: {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
                      </Text>
                    </HStack>
                  ) : null}
                </Stack>

                <Stack gap={0.5}>
                  <Text fontWeight="medium">Link (optional)</Text>
                  <Input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                  />
                </Stack>
              </>
            ) : isLinksFlow ? (
              <>
                <LinkUrlInput
                  value={link}
                  onChange={setLink}
                  linkResolved={linkResolved}
                  autoFocus
                />

                {resolving ? (
                  <Text fontSize="sm" color="fg.muted">
                    Looking up…
                  </Text>
                ) : null}

                {hints.length > 0 ? (
                  <Stack gap={1}>
                    {hints.map((h) => (
                      <Text key={h} fontSize="sm" color="fg.muted">
                        {h}
                      </Text>
                    ))}
                  </Stack>
                ) : null}

                <Stack gap={0.5}>
                  <Text fontWeight="medium">Title</Text>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </Stack>
              </>
            ) : mediaForm ? (
              <>
                <MediaRecommendationFields
                  config={mediaForm}
                  title={title}
                  creator={creator}
                  mediaSource={mediaSource}
                  link={link}
                  onTitleChange={setTitle}
                  onCreatorChange={setCreator}
                  onMediaSourceChange={setMediaSource}
                  onLinkChange={setLink}
                  autoFocus={!isOther}
                />

                {resolving ? (
                  <Text fontSize="sm" color="fg.muted">
                    Looking up…
                  </Text>
                ) : null}

                {hints.length > 0 ? (
                  <Stack gap={1}>
                    {hints.map((h) => (
                      <Text key={h} fontSize="sm" color="fg.muted">
                        {h}
                      </Text>
                    ))}
                  </Stack>
                ) : null}
              </>
            ) : null}

            <Stack gap={0.5}>
              <Text fontWeight="medium">Your rating</Text>
              <StarRatingInput value={rating} onChange={setRating} />
            </Stack>

            <Stack gap={0.5}>
              <Text fontWeight="medium">Comment</Text>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </Stack>

            <HStack justify="flex-end" flexWrap="wrap" gap={2}>
              <PondButton
                onClick={() => void submit()}
                disabled={saving || !canSubmit}
                loading={saving}
              >
                {saving ? "Saving…" : "Post recommendation"}
              </PondButton>
            </HStack>
          </>
        )}
      </Stack>
    </AppModal>
  );
}
