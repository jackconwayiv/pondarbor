import { Heading, type HeadingProps } from "@chakra-ui/react";

import { SQUALLS_HEADING_FONT_FAMILY } from "./squallsTheme";

/** In-voyage display headings (Pirata One), scoped to Squalls play surfaces. */
export function SquallsHeading(props: HeadingProps) {
  return (
    <Heading
      fontFamily={SQUALLS_HEADING_FONT_FAMILY}
      fontWeight="normal"
      {...props}
    />
  );
}
