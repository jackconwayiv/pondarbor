import { Box, Text } from "@chakra-ui/react";
import { memo, useEffect, useRef, useState } from "react";

import "./DenizenPurchaseTimeline.css";

function DenizenPurchaseTimeline({
  timeline,
}: {
  timeline: readonly string[];
}) {
  const [pulseNewest, setPulseNewest] = useState(false);
  const prevLenRef = useRef(timeline.length);

  useEffect(() => {
    if (timeline.length > prevLenRef.current) {
      setPulseNewest(true);
      const id = window.setTimeout(() => setPulseNewest(false), 2_500);
      prevLenRef.current = timeline.length;
      return () => window.clearTimeout(id);
    }
    prevLenRef.current = timeline.length;
  }, [timeline.length]);

  if (timeline.length === 0) return null;

  const [newest, ...rest] = timeline;
  const restJoined = rest.join("");

  return (
    <Box
      className="denizenPurchaseTimeline"
      role="region"
      aria-label={`Denizen purchase timeline, ${timeline.length} purchases`}
      mt="2"
    >
      <Text as="span" className="denizenPurchaseTimelineTrack" aria-hidden>
        {newest ? (
          <Text
            as="span"
            className={
              pulseNewest
                ? "denizenPurchaseTimelineGlyph denizenPurchaseTimelineGlyph--new"
                : "denizenPurchaseTimelineGlyph"
            }
          >
            {newest}
          </Text>
        ) : null}
        {restJoined ? (
          <Text as="span" className="denizenPurchaseTimelineGlyph">
            {restJoined}
          </Text>
        ) : null}
      </Text>
    </Box>
  );
}

export default memo(DenizenPurchaseTimeline);
