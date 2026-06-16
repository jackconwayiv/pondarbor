import { Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { createReviewOnEntry } from "./api";
import StarRatingInput from "./StarRatingInput";
import { normalizeRatingInput } from "./utils";

type WriteReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: number;
  entryTitle: string;
  onSuccess?: () => void;
};

export default function WriteReviewModal({
  open,
  onOpenChange,
  entryId,
  entryTitle,
  onSuccess,
}: WriteReviewModalProps) {
  const { getApiAccessToken } = useAppSession();
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [dateRecommended, setDateRecommended] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBody("");
    setRating(0);
    setDateRecommended(new Date().toISOString().slice(0, 10));
    setError(null);
    setSaving(false);
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await createReviewOnEntry(token, entryId, {
        rating: normalizeRatingInput(rating),
        body: body.trim(),
        date_recommended: dateRecommended,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Write a review"
      description={entryTitle}
      size="md"
    >
      <Stack gap={4} pt={1}>
        {error ? <Text color="red.500">{error}</Text> : null}

        <Stack gap={1}>
          <Text fontWeight="medium">Your rating</Text>
          <StarRatingInput value={rating} onChange={setRating} />
        </Stack>

        <Stack gap={1}>
          <Text fontWeight="medium">Comment</Text>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        </Stack>

        <Stack gap={1}>
          <Text fontWeight="medium">Date recommended</Text>
          <Input
            type="date"
            value={dateRecommended}
            onChange={(e) => setDateRecommended(e.target.value)}
          />
        </Stack>

        <PondButton
          onClick={() => void submit()}
          disabled={saving || !body.trim() || rating < 1}
          loading={saving}
        >
          {saving ? "Saving…" : "Post review"}
        </PondButton>
      </Stack>
    </AppModal>
  );
}
