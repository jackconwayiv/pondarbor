import { HStack, Input, NativeSelectField, NativeSelectRoot, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import {
  CLOSET_CATEGORY_PRESETS,
  CLOSET_CATEGORY_PRESET_SET,
  CLOSET_CUSTOM_SELECT_VALUE,
  closetCategorySelectValue,
} from "./categories";
import { APP_TEXT_SIZES, PANEL_FORM_PLACEHOLDER_PROPS } from "../theme/typography";

const INPUT_PLACEHOLDER_PROPS = PANEL_FORM_PLACEHOLDER_PROPS;

export function ClosetCategoryFields({
  category,
  onCategoryChange,
}: {
  category: string;
  onCategoryChange: (next: string) => void;
}) {
  /** True when the user chose Custom while the stored category was still empty (or we cleared a preset). */
  const [customChosenWithEmpty, setCustomChosenWithEmpty] = useState(false);

  const derivedSelect = closetCategorySelectValue(category);
  const selectValue =
    customChosenWithEmpty && derivedSelect === "" ? CLOSET_CUSTOM_SELECT_VALUE : derivedSelect;
  const showCustomInput = selectValue === CLOSET_CUSTOM_SELECT_VALUE;

  return (
    <HStack
      align="flex-start"
      justify="space-between"
      gap={{ base: "3", md: "4" }}
      w="100%"
      flexWrap="wrap"
    >
      <Stack gap="1" minW={{ base: "100%", sm: "11rem" }} maxW={{ md: "20rem" }} flexShrink={0}>
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
          Category:
        </Text>
        <NativeSelectRoot w="100%">
          <NativeSelectField
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setCustomChosenWithEmpty(false);
                onCategoryChange("");
                return;
              }
              if (v === CLOSET_CUSTOM_SELECT_VALUE) {
                setCustomChosenWithEmpty(true);
                const t = category.trim();
                if (CLOSET_CATEGORY_PRESET_SET.has(t) || !t) {
                  onCategoryChange("");
                }
                return;
              }
              setCustomChosenWithEmpty(false);
              onCategoryChange(v);
            }}
          >
            <option value="">None</option>
            {CLOSET_CATEGORY_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={CLOSET_CUSTOM_SELECT_VALUE}>Custom…</option>
          </NativeSelectField>
        </NativeSelectRoot>
      </Stack>
      {showCustomInput ? (
        <Stack
          gap="1"
          flex={{ base: "1 1 100%", md: "1 1 auto" }}
          minW={{ base: "100%", md: "12rem" }}
          maxW={{ md: "26rem" }}
          align="stretch"
        >
          <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600" fontWeight="medium" lineHeight="short">
            Custom Category:
          </Text>
          <Input
            value={category}
            onChange={(e) => {
              setCustomChosenWithEmpty(false);
              onCategoryChange(e.target.value);
            }}
            placeholder={"letters and '/' only"}
            {...INPUT_PLACEHOLDER_PROPS}
          />
        </Stack>
      ) : null}
    </HStack>
  );
}
