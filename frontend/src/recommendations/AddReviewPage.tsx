import {
  Box,
  Heading,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { SessionLoadingCard } from "../components/panelStatus";
import { fetchEntry, patchReview } from "./api";
import StarRatingInput from "./StarRatingInput";
import { normalizeRatingInput } from "./utils";

export default function EditReviewPage() {
  const { categorySlug = "", entryId: entryIdParam } = useParams();
  const editEntryId = Number.parseInt(entryIdParam ?? "", 10);
  const navigate = useNavigate();
  const { getApiAccessToken, isLoading } = useAppSession();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewId, setReviewId] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(editEntryId)) return;
    void (async () => {
      const token = await getApiAccessToken();
      const entry = await fetchEntry(token, editEntryId);
      setTitle(entry.title);
      const mine = entry.reviews?.find((r) => r.id === entry.viewer_review_id);
      if (mine) {
        setReviewId(mine.id);
        setRating(normalizeRatingInput(Number.parseFloat(mine.rating)));
        setBody(mine.body);
      }
    })();
  }, [editEntryId, getApiAccessToken]);

  const submit = async () => {
    if (!reviewId) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await patchReview(token, reviewId, {
        rating: normalizeRatingInput(rating),
        body: body.trim() || undefined,
      });
      navigate(`/recommendations/${categorySlug}?entry=${editEntryId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <SessionLoadingCard />;

  return (
    <Stack gap={6} maxW="2xl" mx="auto">
      <RouterLink to={`/recommendations/${categorySlug}?entry=${editEntryId}`}>
        <PondButton variant="ghost" size="sm">← Back</PondButton>
      </RouterLink>

      <Heading size="lg">Edit your review</Heading>

      {error ? <Text color="red.500">{error}</Text> : null}

      <Box>
        <Text color="fg.muted">Editing your review for “{title}”.</Text>
      </Box>

      <Stack gap={1}>
        <Text fontWeight="medium">Your rating</Text>
        <StarRatingInput value={rating} onChange={setRating} />
      </Stack>

      <Stack gap={1}>
        <Text fontWeight="medium">Comment (optional when changing rating only)</Text>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      </Stack>

      <PondButton onClick={() => void submit()} disabled={saving || !reviewId} loading={saving}>
        {saving ? "Saving…" : "Save review"}
      </PondButton>
    </Stack>
  );
}
