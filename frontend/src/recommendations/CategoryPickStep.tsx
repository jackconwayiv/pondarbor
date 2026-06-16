import { SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import PondButton from "../PondButton";
import { CATEGORY_GROUPS, categoriesForGroup, categoryPickLabel } from "./categoryGroups";
import type { RecommendationCategory } from "./types";

type CategoryPickStepProps = {
  categories: RecommendationCategory[];
  onPickCategory: (slug: string) => void;
  onPickOther: () => void;
};

type CategoryPickTileProps = {
  emoji: string;
  label: string;
  onClick: () => void;
};

function CategoryPickTile({ emoji, label, onClick }: CategoryPickTileProps) {
  return (
    <PondButton
      type="button"
      uiClass="filter"
      onClick={onClick}
      w="100%"
      aspectRatio={1}
      h="auto"
      minH={0}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      p={2}
      whiteSpace="normal"
      textAlign="center"
      lineHeight="short"
    >
      <Text as="span" fontSize="xl" lineHeight={1} aria-hidden>
        {emoji}
      </Text>
      <Text as="span" fontSize="xs" fontWeight="semibold">
        {label}
      </Text>
    </PondButton>
  );
}

export default function CategoryPickStep({
  categories,
  onPickCategory,
  onPickOther,
}: CategoryPickStepProps) {
  const presetCategories = useMemo(
    () =>
      CATEGORY_GROUPS.flatMap((group) =>
        categoriesForGroup(group.id, categories).filter((c) => c.is_preset),
      ),
    [categories],
  );

  return (
    <Stack gap={2}>
      <Text fontWeight="medium">What are you recommending?</Text>
      <SimpleGrid columns={{ base: 4, md: 5 }} gap={2} w="100%">
        {presetCategories.map((cat) => (
          <CategoryPickTile
            key={cat.slug}
            emoji={cat.emoji || "📌"}
            label={categoryPickLabel(cat)}
            onClick={() => onPickCategory(cat.slug)}
          />
        ))}
        <CategoryPickTile emoji="✨" label="Other" onClick={onPickOther} />
      </SimpleGrid>
    </Stack>
  );
}
