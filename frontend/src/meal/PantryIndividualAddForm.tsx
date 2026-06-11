import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { fetchIngredientVocab, upsertPantryInventory } from "./api";
import { IngredientFoodGroupSelect } from "./IngredientFoodGroupSelect";
import { emptyPantryTags, normalizePantryTags } from "./pantryTagVocab";
import { PantryTagsEditor } from "./PantryTagsEditor";
import type { PantryTags } from "./types";

type PantryIndividualAddFormProps = {
  getApiAccessToken: () => Promise<string | null>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onAdded: () => Promise<void>;
};

export function PantryIndividualAddForm({
  getApiAccessToken,
  busy,
  setBusy,
  onAdded,
}: PantryIndividualAddFormProps) {
  const [search, setSearch] = useState("");
  const [pickId, setPickId] = useState<number | "">("");
  const [qty, setQty] = useState("1");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<PantryTags>(emptyPantryTags());
  const [foodGroup, setFoodGroup] = useState("");
  const [opts, setOpts] = useState<{ id: number; name: string; food_group?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setOpts([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const tok = await getApiAccessToken();
          setOpts(await fetchIngredientVocab(tok, q));
        } catch {
          setOpts([]);
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, getApiAccessToken]);

  return (
    <Stack gap="4">
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
        Search the ingredient vocabulary, set quantity and optional import location, then add tags.
      </Text>
      <HStack gap="2" flexWrap="wrap" align="flex-end">
        <Input
          flex="1"
          minW="10rem"
          placeholder="Search ingredients (2+ letters)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          {...PANEL_FIELD_PROPS}
        />
        <PondNativeSelect
          rootProps={{ minW: "10rem" }}
          fieldProps={{
            value: pickId === "" ? "" : String(pickId),
            onChange: (e) => {
              const v = e.target.value ? Number(e.target.value) : "";
              setPickId(v);
              if (v === "") {
                setFoodGroup("");
                return;
              }
              const picked = opts.find((o) => o.id === v);
              setFoodGroup(picked?.food_group ?? "");
            },
          }}
        >
          <option value="">Pick…</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </PondNativeSelect>
      </HStack>
      <HStack gap="2" flexWrap="wrap" align="flex-end">
        <Input
          w="8rem"
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          {...PANEL_FIELD_PROPS}
        />
        <Input
          w="5rem"
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          {...PANEL_FIELD_PROPS}
        />
      </HStack>
      <IngredientFoodGroupSelect value={foodGroup} onChange={setFoodGroup} disabled={busy} />

      <PantryTagsEditor value={tags} onChange={setTags} disabled={busy} />
      {err ? (
        <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}
      <PondButton
        colorPalette="lilypad"
        loading={busy}
        disabled={pickId === ""}
        onClick={() => {
          if (pickId === "") return;
          void (async () => {
            setBusy(true);
            setErr(null);
            try {
              const tok = await getApiAccessToken();
              await upsertPantryInventory(tok, {
                ingredient_id: Number(pickId),
                quantity: Math.max(0, parseInt(qty, 10) || 0),
                simple_have: null,
                location: location.trim(),
                pantry_tags: normalizePantryTags(tags),
                food_group: foodGroup,
              });
              setSearch("");
              setPickId("");
              setLocation("");
              setQty("1");
              setFoodGroup("");
              setTags(emptyPantryTags());
              setOpts([]);
              await onAdded();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not add item.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        Add / update
      </PondButton>
    </Stack>
  );
}
