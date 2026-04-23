import { HStack, Text } from "@chakra-ui/react";

import PondButton from "../PondButton";

type Props = {
  heartCount: number;
  viewerHasHearted: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
};

export default function SongadayHeartButton({
  heartCount,
  viewerHasHearted,
  disabled,
  busy,
  onToggle,
}: Props) {
  return (
    <PondButton
      type="button"
      size="sm"
      variant={viewerHasHearted ? "solid" : "outline"}
      colorPalette="teal"
      bg={viewerHasHearted ? "teal.solid" : "white"}
      color="black"
      borderWidth="1px"
      disabled={disabled || busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={viewerHasHearted}
    >
      <HStack gap="1">
        <Text as="span">❤️</Text>
        {heartCount > 0 ? (
          <Text as="span">{heartCount}</Text>
        ) : null}
      </HStack>
    </PondButton>
  );
}
