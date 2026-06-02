import { Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { normalizePantryTags } from "./pantryTagVocab";
import { PantryTagsEditor } from "./PantryTagsEditor";
import type { PantryInventoryRow, PantryTags } from "./types";

export type PantryRowSaveBody = {
  ingredient_id: number;
  quantity?: number;
  simple_have?: boolean | null;
  location?: string;
  inventory_id?: number;
  pantry_tags?: PantryTags;
};

type PantryRowEditFormProps = {
  row: PantryInventoryRow;
  busy: boolean;
  onSave: (body: PantryRowSaveBody) => Promise<void>;
};

export function PantryRowEditForm({ row, busy, onSave }: PantryRowEditFormProps) {
  const [qty, setQty] = useState(String(row.quantity));
  const [mode, setMode] = useState<"count" | "simple">(row.simple_have == null ? "count" : "simple");
  const [location, setLocation] = useState(row.location ?? "");
  const [tags, setTags] = useState<PantryTags>(normalizePantryTags(row.pantry_tags));
  const [simpleHave, setSimpleHave] = useState<boolean | null>(row.simple_have);

  const saveBody = (): PantryRowSaveBody => ({
    ingredient_id: row.ingredient.id,
    inventory_id: row.id,
    location: location.trim(),
    pantry_tags: tags,
  });

  return (
    <Stack gap="4">
      <Stack gap="2">
        <Text fontSize={APP_TEXT_SIZES.label}>Import location</Text>
        <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
          From bulk import section headers (e.g. chest freezer). Separate from storage tags below.
        </Text>
        <Input
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          {...PANEL_FIELD_PROPS}
        />
      </Stack>

      <Stack gap="2">
        <Text fontSize={APP_TEXT_SIZES.label}>Quantity</Text>
        <PondNativeSelect
          fieldProps={{
            value: mode,
            onChange: (e) => setMode(e.target.value as "count" | "simple"),
          }}
        >
          <option value="count">Count</option>
          <option value="simple">Have / Don’t have</option>
        </PondNativeSelect>
        {mode === "count" ? (
          <Input
            w="8rem"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            {...PANEL_FIELD_PROPS}
          />
        ) : (
          <PondNativeSelect
            fieldProps={{
              value: simpleHave === true ? "1" : simpleHave === false ? "0" : "",
              onChange: (e) => {
                const v = e.target.value;
                setSimpleHave(v === "1" ? true : v === "0" ? false : null);
              },
            }}
          >
            <option value="">—</option>
            <option value="1">Have</option>
            <option value="0">Don’t have</option>
          </PondNativeSelect>
        )}
      </Stack>

      <PantryTagsEditor value={tags} onChange={setTags} disabled={busy} />

      <PondButton
        colorPalette="lilypad"
        loading={busy}
        onClick={() => {
          const body = saveBody();
          if (mode === "count") {
            void onSave({
              ...body,
              quantity: Math.max(0, parseInt(qty, 10) || 0),
              simple_have: null,
            });
          } else {
            void onSave({
              ...body,
              simple_have: simpleHave,
            });
          }
        }}
      >
        Save
      </PondButton>
    </Stack>
  );
}
