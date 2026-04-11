import { HStack, Input, Stack, Textarea } from "@chakra-ui/react";
import type { ReactNode } from "react";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";

export type MealEditorFormProps = {
  title: string;
  blurb: string;
  directions: string;
  ingredientsText: string;
  onTitleChange: (value: string) => void;
  onBlurbChange: (value: string) => void;
  onDirectionsChange: (value: string) => void;
  onIngredientsTextChange: (value: string) => void;
  onSave: () => void;
  /** Persist when a field loses focus (e.g. meal detail edit). */
  onBlurSave?: () => void | Promise<void>;
  saveLabel?: string;
  saveDisabled?: boolean;
  saveLoading?: boolean;
  disabled?: boolean;
  trailingActions?: ReactNode;
  /** Tighter recipe columns for dialogs and small surfaces */
  compact?: boolean;
  /** In compact mode on narrow viewports, use larger body text for readability. */
  compactBoostMobile?: boolean;
  /** Recipe photo controls (e.g. `MealImageField`). */
  recipeImage?: ReactNode;
};

const recipeMinH = {
  default: { base: "11rem" as const, md: "min(42vh, 16rem)" as const },
  compact: { base: "9rem" as const, md: "min(28vh, 12rem)" as const },
};

/**
 * Shared add/edit meal fields: name + save on one row, blurb, then ingredients | directions side by side.
 */
export function MealEditorForm({
  title,
  blurb,
  directions,
  ingredientsText,
  onTitleChange,
  onBlurbChange,
  onDirectionsChange,
  onIngredientsTextChange,
  onSave,
  onBlurSave,
  saveLabel = "Save meal",
  saveDisabled = false,
  saveLoading = false,
  disabled = false,
  trailingActions,
  compact = false,
  compactBoostMobile = false,
  recipeImage,
}: MealEditorFormProps) {
  const isMobile = useIsMobile();
  const h = compact ? recipeMinH.compact : recipeMinH.default;
  const stackFontSize =
    compact && compactBoostMobile && isMobile
      ? ({ base: "md" as const, md: "md" as const })
      : APP_TEXT_SIZES.body;

  function emitBlurSave() {
    void Promise.resolve(onBlurSave?.());
  }

  return (
    <Stack gap="2" w="100%" fontSize={stackFontSize}>
      {recipeImage}
      <HStack gap="2" flexWrap="wrap" align="flex-end" w="100%">
        <Input
          flex="1"
          minW="min(100%, 10rem)"
          placeholder="Name"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={emitBlurSave}
          disabled={disabled}
          {...PANEL_FIELD_PROPS}
        />
        <HStack gap="2" flexShrink={0} flexWrap="wrap">
          <PondButton
            colorPalette="lilypad"
            loading={saveLoading}
            disabled={disabled || saveDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
          >
            {saveLabel}
          </PondButton>
          {trailingActions}
        </HStack>
      </HStack>

      <Textarea
        value={blurb}
        onChange={(e) => onBlurbChange(e.target.value)}
        onBlur={emitBlurSave}
        placeholder="Blurb (optional)"
        disabled={disabled}
        minH="4.5rem"
        resize="vertical"
        {...PANEL_FIELD_PROPS}
      />

      <Stack direction={{ base: "column", md: "row" }} gap="2" align="stretch" w="100%">
        <Textarea
          flex="1"
          minW="0"
          value={ingredientsText}
          onChange={(e) => onIngredientsTextChange(e.target.value)}
          onBlur={emitBlurSave}
          placeholder="Ingredients (one line per item)"
          disabled={disabled}
          minH={h}
          resize="vertical"
          {...PANEL_FIELD_PROPS}
        />
        <Textarea
          flex="1"
          minW="0"
          value={directions}
          onChange={(e) => onDirectionsChange(e.target.value)}
          onBlur={emitBlurSave}
          placeholder="Directions (optional)"
          disabled={disabled}
          minH={h}
          resize="vertical"
          {...PANEL_FIELD_PROPS}
        />
      </Stack>
    </Stack>
  );
}
