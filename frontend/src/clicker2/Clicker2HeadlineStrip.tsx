import { Box, Grid } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { HIDE_SCROLLBAR_CSS } from "../theme/typography";

import "./Clicker2HeadlineStrip.css";

/** Transparent slot between counters and pond — milestones, headlines, etc. */
export function Clicker2HeadlineStrip({
  mode,
  children,
}: {
  mode: "milestones" | "headline";
  children?: ReactNode;
}) {
  if (mode === "headline") {
    return (
      <Box
        className="pond2HeadlineStrip pond2HeadlineStrip--headline"
        w="full"
        maxW={{ base: "full", lg: "520px" }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      className="pond2HeadlineStrip"
      w="full"
      maxW={{ base: "full", lg: "520px" }}
    >
      <Grid
        className="pond2HeadlineStripGrid"
        templateColumns="repeat(2, minmax(0, 1fr))"
        gap="1.5"
        css={HIDE_SCROLLBAR_CSS}
      >
        {children}
      </Grid>
    </Box>
  );
}
