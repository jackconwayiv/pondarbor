/** Match Meal Maestro modal / detail tab chrome (see MealSlotPickerDialog, MealMealDetailPage). */
export const CLOSET_MODAL_TAB_LIST_PROPS = {
  px: { base: "2", md: "2" } as const,
  pt: "0",
  pb: "0",
  borderBottomWidth: "1px",
  borderColor: "border",
  gap: "1",
  w: "100%",
};

export function closetModalTabTriggerProps(activeTab: string, value: string) {
  return {
    value,
    bg: activeTab === value ? "lilypad.solid" : undefined,
    color: activeTab === value ? "black" : undefined,
    borderTopRadius: "md" as const,
    borderBottomRadius: "0" as const,
    px: "2",
    py: "2",
    fontWeight: "medium" as const,
    _hover: {
      bg: activeTab === value ? "lilypad.solid" : "transparent",
    },
    _selected: { bg: "lilypad.solid", color: "black" },
  };
}
