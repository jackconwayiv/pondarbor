import {
  Box,
  Checkbox,
  Field,
  Grid,
  HStack,
  Input,
  RadioGroup,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { createTemplate, fetchTemplate, updateTemplate } from "./api";
import { categoryRowColor } from "./playerColors";
import { ScoringStepperInput } from "./ScoringStepperInput";
import {
  clampTemplateDefaultRounds,
  clampTemplateMinPlayers,
  SCORENADO_DEFAULT_MIN_PLAYERS,
  SCORENADO_DEFAULT_ROUND_COUNT,
} from "./scorenadoTemplateSetup";
import type { TemplateCategoryInput } from "./types";

const MAX_CATEGORIES = 12;

type CategoryDraft = TemplateCategoryInput & { key: string };

const DEFAULT_POINTS_CATEGORY_NAME = "Points";

function blankCategory(): CategoryDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    description: "",
    is_scored: true,
  };
}

type ScorenadoTemplateEditorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit or null for a new template. */
  templateId?: string | null;
  onSaved?: () => void | Promise<void>;
};

export function ScorenadoTemplateEditorModal({
  open,
  onOpenChange,
  templateId = null,
  onSaved,
}: ScorenadoTemplateEditorModalProps) {
  const isNew = !templateId;
  const { getApiAccessToken } = useAppSession();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [scoredByRounds, setScoredByRounds] = useState(false);
  const [lowScoreWins, setLowScoreWins] = useState(false);
  const [minPlayers, setMinPlayers] = useState(SCORENADO_DEFAULT_MIN_PLAYERS);
  const [defaultRoundCount, setDefaultRoundCount] = useState(
    SCORENADO_DEFAULT_ROUND_COUNT,
  );
  const [isPublished, setIsPublished] = useState(false);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalSteps = 1 + categories.length;
  const isSetupStep = stepIndex === 0;
  const categoryIndex = stepIndex - 1;
  const currentCategory =
    !isSetupStep && categoryIndex >= 0 && categoryIndex < categories.length
      ? categories[categoryIndex]
      : null;

  const resetDraft = useCallback(() => {
    setStepIndex(0);
    setName("");
    setScoredByRounds(false);
    setLowScoreWins(false);
    setMinPlayers(SCORENADO_DEFAULT_MIN_PLAYERS);
    setDefaultRoundCount(SCORENADO_DEFAULT_ROUND_COUNT);
    setIsPublished(false);
    setCategories([]);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    if (!templateId) {
      resetDraft();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const t = await fetchTemplate(token, templateId);
      if (!t.can_edit) {
        setError("You can use this template for games but cannot edit it.");
        return;
      }
      setName(t.name);
      setIsPublished(t.is_published);
      setScoredByRounds(t.scored_by_rounds);
      setLowScoreWins(t.low_score_wins);
      setMinPlayers(clampTemplateMinPlayers(t.min_players));
      setDefaultRoundCount(clampTemplateDefaultRounds(t.default_round_count));
      setCategories(
        t.categories.map((c) => ({
          key: c.id,
          name: c.name,
          description: c.description,
          sort_order: c.sort_order,
          is_scored: c.is_scored,
        })),
      );
      setStepIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load template.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, resetDraft, templateId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (stepIndex < totalSteps) return;
    setStepIndex(Math.max(0, totalSteps - 1));
  }, [stepIndex, totalSteps]);

  const updateCategory = (key: string, patch: Partial<CategoryDraft>) => {
    setCategories((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const addCategory = () => {
    setCategories((rows) => {
      const cat = blankCategory();
      setStepIndex(rows.length + 1);
      return [...rows, cat];
    });
  };

  const removeCategory = (key: string) => {
    setCategories((rows) => {
      const removedIdx = rows.findIndex((row) => row.key === key);
      const next = rows.filter((row) => row.key !== key);
      setStepIndex((step) => {
        if (removedIdx < 0) return step;
        const removedStep = removedIdx + 1;
        if (step === removedStep) {
          return next.length === 0 ? 0 : Math.min(removedStep, next.length);
        }
        if (step > removedStep) return step - 1;
        return step;
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Template name is required.");
      setStepIndex(0);
      return;
    }
    let cats = categories
      .filter((c) => c.name.trim())
      .map((c, idx) => ({
        name: c.name.trim(),
        description: (c.description ?? "").trim(),
        sort_order: idx,
        is_scored: c.is_scored ?? true,
      }));
    if (cats.length === 0) {
      cats = [
        {
          name: DEFAULT_POINTS_CATEGORY_NAME,
          description: "",
          sort_order: 0,
          is_scored: true,
        },
      ];
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const payload = {
        name: trimmedName,
        scored_by_rounds: scoredByRounds,
        low_score_wins: lowScoreWins,
        min_players: clampTemplateMinPlayers(minPlayers),
        default_round_count: clampTemplateDefaultRounds(defaultRoundCount),
        is_published: isPublished,
        categories: cats,
      };
      if (isNew) {
        await createTemplate(token, payload);
      } else {
        await updateTemplate(token, templateId, payload);
      }
      onOpenChange(false);
      await onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(name.trim());

  const hasNextPage = stepIndex < totalSteps - 1;
  const canAddCategory = categories.length < MAX_CATEGORIES;

  const modalFooter = (
    <Grid
      templateColumns="1fr auto 1fr"
      alignItems="center"
      gap="2"
      w="100%"
      pt="3"
      mt="2"
      borderTopWidth="1px"
      borderColor="border"
    >
      <Box justifySelf="start">
        {stepIndex > 0 ? (
          <PondButton
            size="sm"
            variant="outline"
            colorPalette="sky"
            onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
          >
            Previous
          </PondButton>
        ) : null}
      </Box>
      <Box justifySelf="center">
        <PondButton
          colorPalette="yellow"
          color="black"
          size="sm"
          loading={saving}
          disabled={!canSubmit || saving || loading}
          onClick={() => void handleSubmit()}
        >
          Save
        </PondButton>
      </Box>
      <Box justifySelf="end">
        {hasNextPage ? (
          <PondButton
            size="sm"
            variant="outline"
            colorPalette="sky"
            onClick={() =>
              setStepIndex((s) => Math.min(totalSteps - 1, s + 1))
            }
          >
            Next
          </PondButton>
        ) : canAddCategory ? (
          <PondButton size="sm" colorPalette="teal" onClick={addCategory}>
            Add Category
          </PondButton>
        ) : null}
      </Box>
    </Grid>
  );

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="scorenado-pixel-title" style={{ fontSize: "0.65rem" }}>
          {isNew ? "NEW TEMPLATE" : "EDIT TEMPLATE"}
        </span>
      }
      size="xl"
      contentProps={{
        maxH: "min(90vh, 42rem)",
        display: "flex",
        flexDirection: "column",
      }}
      bodyProps={{
        overflowY: "auto",
        flex: "1",
        minH: "0",
      }}
    >
      <Stack gap="3" className="scorenado-retro">
        {error ? (
          <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
            {error}
          </Text>
        ) : null}

        {loading ? (
          <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
            Loading…
          </Text>
        ) : (
          <>
            {isSetupStep ? (
          <Box
            className="scorenado-template-meta"
            bg={categoryRowColor(0)}
            p="3"
            rounded="2xl"
          >
            <Field.Root>
              <Field.Label className="scorenado-pixel-body">Game name</Field.Label>
              <Input
                {...PANEL_FIELD_PROPS}
                bg="white"
                borderColor="gray.400"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field.Root>

            <Field.Root mt="3">
              <Field.Label className="scorenado-pixel-body">Visibility</Field.Label>
              <RadioGroup.Root
                value={isPublished ? "published" : "private"}
                onValueChange={(details) => {
                  const next = details.value;
                  if (next === "published" || next === "private") {
                    setIsPublished(next === "published");
                  }
                }}
              >
                <HStack gap="4" flexWrap="wrap" align="flex-start" pt="1">
                  <RadioGroup.Item value="private">
                    <RadioGroup.ItemHiddenInput />
                    <HStack gap="2" align="center">
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText className="scorenado-pixel-body">
                        Private
                      </RadioGroup.ItemText>
                    </HStack>
                  </RadioGroup.Item>
                  <RadioGroup.Item value="published">
                    <RadioGroup.ItemHiddenInput />
                    <HStack gap="2" align="center">
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText className="scorenado-pixel-body">
                        Shared
                      </RadioGroup.ItemText>
                    </HStack>
                  </RadioGroup.Item>
                </HStack>
              </RadioGroup.Root>
            </Field.Root>

            <HStack gap="4" flexWrap="wrap" mt="3">
              <Checkbox.Root
                colorPalette="teal"
                checked={scoredByRounds}
                onCheckedChange={(e) => setScoredByRounds(!!e.checked)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label>Scored by rounds</Checkbox.Label>
              </Checkbox.Root>
              <Checkbox.Root
                colorPalette="teal"
                checked={lowScoreWins}
                onCheckedChange={(e) => setLowScoreWins(!!e.checked)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label>Low score wins</Checkbox.Label>
              </Checkbox.Root>
            </HStack>

            <HStack gap="4" flexWrap="wrap" align="flex-end" mt="3">
              <Field.Root flex="1" minW="10rem">
                <Field.Label className="scorenado-pixel-body">
                  Minimum players
                </Field.Label>
                <HStack justify="flex-start" py="1">
                  <ScoringStepperInput
                    value={minPlayers}
                    onChange={(v) => {
                      if (v == null) return;
                      setMinPlayers(clampTemplateMinPlayers(v));
                    }}
                  />
                </HStack>
              </Field.Root>

              {scoredByRounds ? (
                <Field.Root flex="1" minW="10rem">
                  <Field.Label className="scorenado-pixel-body">
                    Default rounds
                  </Field.Label>
                  <HStack justify="flex-start" py="1">
                    <ScoringStepperInput
                      value={defaultRoundCount}
                      onChange={(v) => {
                        if (v == null) return;
                        setDefaultRoundCount(clampTemplateDefaultRounds(v));
                      }}
                    />
                  </HStack>
                </Field.Root>
              ) : null}
            </HStack>
          </Box>
        ) : currentCategory ? (
          <Box
            className="scorenado-template-row"
            bg={categoryRowColor(categoryIndex + 1)}
            p="3"
            rounded="2xl"
          >
            <Text
              className="scorenado-pixel-title"
              fontSize="0.55rem"
              mb="2"
              display="block"
            >
              Scoring category {categoryIndex + 1}
            </Text>
            <Stack gap="2">
              <Field.Root>
                <Field.Label className="scorenado-pixel-body">Name</Field.Label>
                <Input
                  {...PANEL_FIELD_PROPS}
                  bg="white"
                  borderColor="gray.400"
                  value={currentCategory.name}
                  onChange={(e) =>
                    updateCategory(currentCategory.key, { name: e.target.value })
                  }
                />
              </Field.Root>
              <Field.Root>
                <Field.Label className="scorenado-pixel-body">Description</Field.Label>
                <Textarea
                  {...PANEL_FIELD_PROPS}
                  bg="white"
                  borderColor="gray.400"
                  rows={2}
                  value={currentCategory.description ?? ""}
                  onChange={(e) =>
                    updateCategory(currentCategory.key, {
                      description: e.target.value,
                    })
                  }
                />
              </Field.Root>
              <HStack justify="space-between" align="center" gap="2" flexWrap="wrap">
                <Checkbox.Root
                  colorPalette="teal"
                  checked={currentCategory.is_scored ?? true}
                  onCheckedChange={(e) =>
                    updateCategory(currentCategory.key, {
                      is_scored: !!e.checked,
                    })
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label>Scored row</Checkbox.Label>
                </Checkbox.Root>
                <PondButton
                  size="sm"
                  colorPalette="gray"
                  onClick={() => removeCategory(currentCategory.key)}
                >
                  Remove Category
                </PondButton>
              </HStack>
            </Stack>
          </Box>
        ) : null}
            {modalFooter}
          </>
        )}
      </Stack>
    </AppModal>
  );
}
