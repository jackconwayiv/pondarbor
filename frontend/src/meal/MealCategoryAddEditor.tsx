import { Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS, PANEL_FIELD_PROPS } from "../theme/typography";
import { createMealCategoryOption } from "./api";
import type { MealCategoryAxis, MealCategoryOptionRow } from "./MealCategorySelect";

function mergeAndSort(
  opts: MealCategoryOptionRow[],
  created: { id: number; name: string },
): MealCategoryOptionRow[] {
  const rest = opts.filter((o) => o.id !== created.id);
  return [...rest, { id: created.id, name: created.name }].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

const AXIS_CHOICES: { value: MealCategoryAxis; label: string }[] = [
  { value: "meal_type", label: "Meal type" },
  { value: "cuisine", label: "Cuisine" },
  { value: "time", label: "Time" },
];

type Props = {
  getApiAccessToken: () => Promise<string | null>;
  disabled?: boolean;
  /** `sm` matches filter toolbar controls. */
  size?: "sm" | "md";
  /** Toggle button copy (e.g. shorter labels when a parent section is titled “Add category”). */
  triggerLabels?: { closed: string; open: string };
  mealTypeOpts: MealCategoryOptionRow[];
  cuisineOpts: MealCategoryOptionRow[];
  timeOpts: MealCategoryOptionRow[];
  setMealTypeOpts: (opts: MealCategoryOptionRow[]) => void;
  setCuisineOpts: (opts: MealCategoryOptionRow[]) => void;
  setTimeOpts: (opts: MealCategoryOptionRow[]) => void;
  /** After add, select this id in the matching dropdown (filter or meal field). */
  pickMealType: (id: string) => void;
  pickCuisine: (id: string) => void;
  pickTime: (id: string) => void;
};

/**
 * Collapsible editor: one name field + radio axis + Add. New options merge into the matching dropdown and select it.
 */
export function MealCategoryAddEditor({
  getApiAccessToken,
  disabled = false,
  size = "md",
  triggerLabels = { closed: "Add category…", open: "Close add category" },
  mealTypeOpts,
  cuisineOpts,
  timeOpts,
  setMealTypeOpts,
  setCuisineOpts,
  setTimeOpts,
  pickMealType,
  pickCuisine,
  pickTime,
}: Props) {
  const [open, setOpen] = useState(false);
  const [axis, setAxis] = useState<MealCategoryAxis>("meal_type");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inputSize = size === "sm" ? "sm" : "md";

  function close() {
    setOpen(false);
    setErr(null);
    setName("");
  }

  return (
    <Stack gap="2" w="100%">
      <PondButton
        colorPalette="sky"
        variant="outline"
        alignSelf="flex-start"
        disabled={disabled}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
            setErr(null);
          }
        }}
      >
        {open ? triggerLabels.open : triggerLabels.closed}
      </PondButton>

      {open ? (
        <Box {...PANEL_ENTRY_CARD_PROPS} p="3" w="100%" maxW="md">
          <Stack gap="3">
            <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold">
              New category
            </Text>
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
              disabled={disabled || busy}
              size={inputSize}
              {...PANEL_FIELD_PROPS}
            />
            <Stack gap="2" role="radiogroup" aria-label="Category type">
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                Type
              </Text>
              {AXIS_CHOICES.map(({ value, label }) => (
                <label
                  key={value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: disabled || busy ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="meal-category-axis"
                    value={value}
                    checked={axis === value}
                    disabled={disabled || busy}
                    onChange={() => setAxis(value)}
                  />
                  <Text fontSize={APP_TEXT_SIZES.body}>{label}</Text>
                </label>
              ))}
            </Stack>
            {err ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
                {err}
              </Text>
            ) : null}
            <HStack gap="2" flexWrap="wrap">
              <PondButton
                colorPalette="teal"
                loading={busy}
                disabled={disabled || busy || !name.trim()}
                onClick={() => {
                  void (async () => {
                    const raw = name.trim();
                    if (!raw) return;
                    setBusy(true);
                    setErr(null);
                    try {
                      const t = await getApiAccessToken();
                      const created = await createMealCategoryOption(t, { axis, name: raw });
                      const idStr = String(created.id);
                      if (axis === "meal_type") {
                        setMealTypeOpts(mergeAndSort(mealTypeOpts, created));
                        pickMealType(idStr);
                      } else if (axis === "cuisine") {
                        setCuisineOpts(mergeAndSort(cuisineOpts, created));
                        pickCuisine(idStr);
                      } else {
                        setTimeOpts(mergeAndSort(timeOpts, created));
                        pickTime(idStr);
                      }
                      setName("");
                      setOpen(false);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Could not add");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Add
              </PondButton>
              <PondButton variant="outline" disabled={busy} onClick={close}>
                Cancel
              </PondButton>
            </HStack>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
