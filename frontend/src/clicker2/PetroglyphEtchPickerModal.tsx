import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AppModal } from "../components/AppModal";
import { useIsMobile } from "../responsive";

import {
  PETROGLYPH_ETCH_CANCEL_BUTTON,
  PETROGLYPH_ETCH_CONFIRM_BUTTON,
  PETROGLYPH_ETCH_PICKER_BODY,
  PETROGLYPH_ETCH_PICKER_TITLE,
} from "./clicker2Copy";
import { evolutionDisplayEmoji } from "./clicker2OwnedEvolutions";
import { EvolutionShopCard, EvolutionShopCardGrid } from "./EvolutionShopCard";
import type { SpecialtyDef } from "./specialties";

const PETROGLYPH_PICKER_GRID_COLUMNS_DESKTOP = 6;
const PETROGLYPH_PICKER_GRID_COLUMNS_MOBILE = 3;

export default function PetroglyphEtchPickerModal({
  open,
  onOpenChange,
  candidates,
  initialSelectedId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: readonly SpecialtyDef[];
  initialSelectedId?: number | null;
  onConfirm: (specialtyId: number) => void;
}) {
  const isMobile = useIsMobile();
  const gridColumns = isMobile
    ? PETROGLYPH_PICKER_GRID_COLUMNS_MOBILE
    : PETROGLYPH_PICKER_GRID_COLUMNS_DESKTOP;
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedId ?? null,
  );

  useEffect(() => {
    if (!open) return;
    setSelectedId(initialSelectedId ?? candidates[0]?.id ?? null);
  }, [open, initialSelectedId, candidates]);

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={PETROGLYPH_ETCH_PICKER_TITLE}
      size="lg"
    >
      <Stack gap="3">
        <Text fontSize="sm" color="gray.700" lineHeight="1.5">
          {PETROGLYPH_ETCH_PICKER_BODY}
        </Text>
        <Box
          maxH="16rem"
          overflowY="auto"
          borderWidth="1px"
          borderColor="border"
          borderRadius="md"
          bg="bg.subtle"
          px="2"
          py="1.5"
        >
          <EvolutionShopCardGrid gap={isMobile ? "1" : "0.5"} columns={gridColumns}>
            {candidates.map((def) => {
              const selected = selectedId === def.id;
              return (
                <Box
                  key={def.id}
                  onClick={() => setSelectedId(def.id)}
                  cursor="pointer"
                  outline={selected ? "2px solid" : undefined}
                  outlineColor={selected ? "nautical.solid" : undefined}
                  borderRadius="md"
                  title={def.name}
                >
                  <EvolutionShopCard
                    def={def}
                    canHoverFinePointer
                    owned
                    costLabel={evolutionDisplayEmoji(def)}
                  />
                </Box>
              );
            })}
          </EvolutionShopCardGrid>
        </Box>
        <Stack direction="row" gap="2" justify="flex-end" pt="1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {PETROGLYPH_ETCH_CANCEL_BUTTON}
          </Button>
          <Button
            type="button"
            size="sm"
            colorPalette="teal"
            disabled={selectedId == null}
            onClick={() => {
              if (selectedId == null) return;
              onConfirm(selectedId);
              onOpenChange(false);
            }}
          >
            {PETROGLYPH_ETCH_CONFIRM_BUTTON}
          </Button>
        </Stack>
      </Stack>
    </AppModal>
  );
}
