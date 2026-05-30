import { Box, Flex, Grid } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { HIDE_SCROLLBAR_CSS } from "../theme/typography";

import "./Clicker2HeadlineStrip.css";

/** Transparent slot between counters and pond — milestones, headlines, etc. */
export function Clicker2HeadlineStrip({
  mode,
  children,
  milestoneLeadingAction,
}: {
  mode: "milestones" | "headline";
  children?: ReactNode;
  /** Narrow control pinned before the milestone card grid (e.g. dismiss all). */
  milestoneLeadingAction?: ReactNode;
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
      <Flex className="pond2HeadlineStripRow" gap="1.5" h="full" align="stretch">
        {milestoneLeadingAction ? (
          <Box flexShrink={0} h="full" display="flex" alignSelf="stretch">
            {milestoneLeadingAction}
          </Box>
        ) : null}
        <Grid
          className="pond2HeadlineStripGrid"
          flex="1"
          minW={0}
          templateColumns="repeat(2, minmax(0, 1fr))"
          gap="1.5"
          css={HIDE_SCROLLBAR_CSS}
        >
          {children}
        </Grid>
      </Flex>
    </Box>
  );
}
