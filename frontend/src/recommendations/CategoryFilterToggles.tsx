import { Checkbox, Collapsible, Wrap } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import PondButton from "../PondButton";
import type { RecommendationCategory } from "./types";

type CategoryFilterTogglesProps = {
  categories: RecommendationCategory[];
  enabledSlugs: Set<string>;
  onCheckedChange: (slug: string, checked: boolean) => void;
};

export default function CategoryFilterToggles({
  categories,
  enabledSlugs,
  onCheckedChange,
}: CategoryFilterTogglesProps) {
  const [open, setOpen] = useState(false);
  const allEnabled = useMemo(
    () => categories.length > 0 && categories.every((c) => enabledSlugs.has(c.slug)),
    [categories, enabledSlugs],
  );

  if (categories.length === 0) return null;

  return (
    <Collapsible.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Collapsible.Trigger asChild>
        <PondButton
          type="button"
          size="sm"
          uiClass="filter"
          uiActive={open || !allEnabled}
          aria-expanded={open}
        >
          Filters
        </PondButton>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Wrap gap={3} align="center" pt={2}>
          {categories.map((cat) => (
            <Checkbox.Root
              key={cat.slug}
              colorPalette="sky"
              checked={enabledSlugs.has(cat.slug)}
              onCheckedChange={(details) =>
                onCheckedChange(cat.slug, details.checked === true)
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label fontSize="sm" cursor="pointer">
                {cat.emoji ? `${cat.emoji} ` : ""}
                {cat.name}
              </Checkbox.Label>
            </Checkbox.Root>
          ))}
        </Wrap>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function defaultEnabledSlugs(categories: RecommendationCategory[]): Set<string> {
  return new Set(categories.map((c) => c.slug));
}

const STORAGE_PREFIX = "recommendations-filters-";

export function loadEnabledSlugs(
  groupId: string,
  categories: RecommendationCategory[],
): Set<string> {
  const all = defaultEnabledSlugs(categories);
  if (categories.length === 0) return all;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${groupId}`);
    if (!raw) return all;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return all;
    const slugs = new Set(parsed.filter((s): s is string => typeof s === "string"));
    const valid = new Set([...slugs].filter((s) => all.has(s)));
    return valid.size > 0 ? valid : all;
  } catch {
    return all;
  }
}

export function saveEnabledSlugs(groupId: string, enabled: Set<string>): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${groupId}`, JSON.stringify([...enabled]));
  } catch {
    // ignore quota errors
  }
}

export function setSlugEnabled(slugs: Set<string>, slug: string, enabled: boolean): Set<string> {
  const next = new Set(slugs);
  if (enabled) {
    next.add(slug);
  } else {
    next.delete(slug);
  }
  return next;
}
