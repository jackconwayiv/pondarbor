import { Box, Card, Checkbox, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { upsertPantryInventory } from "./api";
import { MealPantryPageGate } from "./MealPantryPageGate";
import { PantryAddModal } from "./PantryAddModal";
import { PantryInventoryList } from "./PantryInventoryList";
import { PantryRowEditModal } from "./PantryRowEditModal";
import type { PantryRowSaveBody } from "./PantryRowEditForm";
import { usePantryInventory } from "./usePantryInventory";
import type { PantryInventoryRow } from "./types";

export default function MealPantryInventoryPage() {
  const { sessionUser, getApiAccessToken, patchMyProfile } = useAppSession();
  const { pantryRows, busy, setBusy, loadErr, refresh, pantryEnabled } = usePantryInventory();
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<PantryInventoryRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (!sessionUser) return null;

  const handleSave = async (body: PantryRowSaveBody) => {
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      await upsertPantryInventory(t, body);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <MealPantryPageGate>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading size="sm" mb="1">
            Inventory
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
            Track what you have on hand. Add items in bulk or one at a time, then tap a row to edit
            quantity, location, and tags.
          </Text>
        </Box>

        <HStack gap="3" flexWrap="wrap" align="center">
          <Text fontSize={APP_TEXT_SIZES.helper}>Pantry tracking</Text>
          <Checkbox.Root
            checked={pantryEnabled}
            onCheckedChange={(d) => {
              const next = d.checked === true;
              void patchMyProfile({ meal_pantry_enabled: next }).catch(() => {});
            }}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label fontSize={APP_TEXT_SIZES.helper}>Enabled</Checkbox.Label>
          </Checkbox.Root>
        </HStack>

        {pantryEnabled ? (
          <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
              <HStack justify="space-between" flexWrap="wrap" gap="2" mb="3">
                <Heading size="sm">Your pantry</Heading>
                <PondButton
                  size="sm"
                  colorPalette="lilypad"
                  onClick={() => setAddOpen(true)}
                >
                  Add to pantry
                </PondButton>
              </HStack>
              {loadErr ? (
                <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" mb="2" role="alert">
                  {loadErr}
                </Text>
              ) : null}
              <PantryInventoryList
                rows={pantryRows}
                busy={busy}
                onEditRow={(row) => {
                  setEditRow(row);
                  setEditOpen(true);
                }}
              />
            </Card.Body>
          </Card.Root>
        ) : (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Enable pantry tracking to manage inventory.
          </Text>
        )}

        <PantryAddModal
          open={addOpen}
          onOpenChange={setAddOpen}
          getApiAccessToken={getApiAccessToken}
          busy={busy}
          setBusy={setBusy}
          onDone={refresh}
        />
        <PantryRowEditModal
          row={editRow}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditRow(null);
          }}
          busy={busy}
          onSave={handleSave}
        />
      </Stack>
    </MealPantryPageGate>
  );
}
