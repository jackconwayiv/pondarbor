import { HStack, Input, Stack, Tag, Text } from "@chakra-ui/react";
import { useState } from "react";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import {
  PANTRY_TAG_DIMENSION_LABELS,
  PANTRY_TAG_DIMENSIONS,
  PANTRY_TAG_PRESETS,
  type PantryTagDimension,
} from "./pantryTagVocab";
import type { PantryTags } from "./types";

type PantryTagsEditorProps = {
  value: PantryTags;
  onChange: (next: PantryTags) => void;
  disabled?: boolean;
};

function toggleTag(list: string[], tag: string): string[] {
  const fold = tag.toLowerCase();
  const has = list.some((t) => t.toLowerCase() === fold);
  if (has) return list.filter((t) => t.toLowerCase() !== fold);
  return [...list, tag];
}

export function PantryTagsEditor({ value, onChange, disabled }: PantryTagsEditorProps) {
  const [customByDim, setCustomByDim] = useState<Partial<Record<PantryTagDimension, string>>>({});

  const setDimension = (dim: PantryTagDimension, tags: string[]) => {
    onChange({ ...value, [dim]: tags });
  };

  return (
    <Stack gap="4">
      {PANTRY_TAG_DIMENSIONS.map((dim) => {
        const presets = PANTRY_TAG_PRESETS[dim];
        const selected = value[dim];
        const custom = customByDim[dim] ?? "";
        const extraTags = selected.filter(
          (t) => !presets.some((p) => p.toLowerCase() === t.toLowerCase()),
        );

        return (
          <Stack key={dim} gap="2">
            <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold">
              {PANTRY_TAG_DIMENSION_LABELS[dim]}
            </Text>
            <HStack flexWrap="wrap" gap="1">
              {presets.map((label) => {
                const isActive = selected.some((t) => t.toLowerCase() === label.toLowerCase());
                return (
                  <Tag.Root
                    key={`${dim}-${label}`}
                    size="sm"
                    colorPalette="lilypad"
                    variant={isActive ? "solid" : "outline"}
                    bg={isActive ? undefined : "bg"}
                    cursor={disabled ? "not-allowed" : "pointer"}
                    opacity={disabled ? 0.6 : 1}
                    onClick={() => {
                      if (disabled) return;
                      setDimension(dim, toggleTag(selected, label));
                    }}
                  >
                    <Tag.Label>{label}</Tag.Label>
                  </Tag.Root>
                );
              })}
              {extraTags.map((label) => {
                const isActive = true;
                return (
                  <Tag.Root
                    key={`${dim}-custom-${label}`}
                    size="sm"
                    colorPalette="sky"
                    variant={isActive ? "solid" : "outline"}
                    cursor={disabled ? "not-allowed" : "pointer"}
                    opacity={disabled ? 0.6 : 1}
                    onClick={() => {
                      if (disabled) return;
                      setDimension(dim, toggleTag(selected, label));
                    }}
                  >
                    <Tag.Label>{label}</Tag.Label>
                  </Tag.Root>
                );
              })}
            </HStack>
            <HStack gap="2">
              <Input
                size="sm"
                flex="1"
                placeholder="Custom tag"
                value={custom}
                disabled={disabled}
                onChange={(e) => setCustomByDim((prev) => ({ ...prev, [dim]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const s = custom.trim();
                  if (!s || disabled) return;
                  setDimension(dim, toggleTag(selected, s));
                  setCustomByDim((prev) => ({ ...prev, [dim]: "" }));
                }}
                {...PANEL_FIELD_PROPS}
              />
              <PondButton
                size="xs"
                variant="ghost"
                colorPalette="teal"
                disabled={disabled || !custom.trim()}
                onClick={() => {
                  const s = custom.trim();
                  if (!s) return;
                  setDimension(dim, toggleTag(selected, s));
                  setCustomByDim((prev) => ({ ...prev, [dim]: "" }));
                }}
              >
                Add
              </PondButton>
            </HStack>
          </Stack>
        );
      })}
    </Stack>
  );
}
