import { HStack, RadioGroup, Stack, Text } from "@chakra-ui/react";
import { CATEGORY_GROUPS, categoriesForGroup } from "./categoryGroups";
import type { RecommendationCategory } from "./types";

type CategoryRadioSelectProps = {
  categories: RecommendationCategory[];
  value: string;
  onChange: (slug: string) => void;
};

export default function CategoryRadioSelect({
  categories,
  value,
  onChange,
}: CategoryRadioSelectProps) {
  return (
    <RadioGroup.Root
      value={value}
      colorPalette="sky"
      onValueChange={(details) => {
        if (details.value) onChange(details.value);
      }}
    >
      <Stack gap={4}>
        {CATEGORY_GROUPS.map((group) => {
          const groupCategories = categoriesForGroup(group.id, categories);
          if (groupCategories.length === 0) return null;
          return (
            <Stack key={group.id} gap={2}>
              <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                {group.emoji} {group.label}
              </Text>
              <HStack gap={3} flexWrap="wrap" align="flex-start">
                {groupCategories.map((cat) => (
                  <RadioGroup.Item key={cat.slug} value={cat.slug}>
                    <RadioGroup.ItemHiddenInput />
                    <HStack gap={2} align="center">
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText fontSize="sm">
                        {cat.emoji ? `${cat.emoji} ` : ""}
                        {cat.name}
                      </RadioGroup.ItemText>
                    </HStack>
                  </RadioGroup.Item>
                ))}
              </HStack>
            </Stack>
          );
        })}
      </Stack>
    </RadioGroup.Root>
  );
}
