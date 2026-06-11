import { HStack, IconButton, Input, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { FaPencil } from "react-icons/fa6";
import PondNativeSelect from "../components/PondNativeSelect";
import { PANEL_FIELD_PROPS } from "../theme/typography";
import {
  MEAL_SLOT_LABEL_MAX_LEN,
  MEAL_SLOT_NAME_OPTIONS,
  normalizeMealSlotLabel,
} from "./mealSlotLabels";

type MealSlotNameEditorProps = {
  labels: string[];
  onChangeLabel: (index: number, value: string) => void;
  disabled?: boolean;
};

function isPresetLabel(label: string): boolean {
  return (MEAL_SLOT_NAME_OPTIONS as readonly string[]).includes(label);
}

export function MealSlotNameEditor({
  labels,
  onChangeLabel,
  disabled,
}: MealSlotNameEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const startEdit = (index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    setEditDraft(labels[index] ?? "");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft("");
  };

  const commitEdit = (index: number) => {
    const normalized = normalizeMealSlotLabel(editDraft);
    if (normalized) onChangeLabel(index, normalized);
    cancelEdit();
  };

  return (
    <Stack gap="2" maxW="md">
      {labels.map((label, i) => (
        <HStack key={i} gap="2" align="center" w="100%">
          {editingIndex === i ? (
            <Input
              flex="1"
              size="sm"
              value={editDraft}
              maxLength={MEAL_SLOT_LABEL_MAX_LEN}
              autoFocus
              disabled={disabled}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={() => commitEdit(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit(i);
                }
                if (e.key === "Escape") cancelEdit();
              }}
              {...PANEL_FIELD_PROPS}
            />
          ) : (
            <>
              <PondNativeSelect
                rootProps={{ size: "sm", flex: "1", minW: 0, disabled }}
                fieldProps={{
                  value: label,
                  onChange: (e) => onChangeLabel(i, e.target.value),
                }}
              >
                {!isPresetLabel(label) ? (
                  <option value={label}>{label}</option>
                ) : null}
                {MEAL_SLOT_NAME_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </PondNativeSelect>
              <IconButton
                type="button"
                aria-label={`Custom name for meal time ${i + 1}`}
                size="sm"
                variant="ghost"
                flexShrink={0}
                disabled={disabled}
                onClick={() => startEdit(i)}
              >
                <FaPencil />
              </IconButton>
            </>
          )}
        </HStack>
      ))}
    </Stack>
  );
}
