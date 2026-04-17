export const ecologyTooltipSurfaceProps = {
  bg: "white",
  color: "black",
  borderWidth: "1px",
  borderColor: "black",
  borderStyle: "solid" as const,
  maxW: "280px",
  px: "2.5",
  py: "2",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};

/** Zag `TooltipRoot`: ecology blurbs are non-interactive; dismiss on scroll/click/pointer-down. */
export const ecologyTooltipRootBaseProps = {
  closeDelay: 100,
  closeOnScroll: true,
  closeOnPointerDown: true,
  closeOnClick: true,
  closeOnEscape: true,
  interactive: false,
} as const;

export const ecologyPopoverContentProps = {
  bg: "white",
  color: "black",
  borderWidth: "1px",
  borderColor: "black",
  borderStyle: "solid" as const,
  maxW: "280px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};
