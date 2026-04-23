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
      variant="outline"
      colorPalette="teal"
      bg={viewerHasHearted ? "bg.subtle" : "white"}
      borderColor={viewerHasHearted ? "teal.solid" : undefined}
      color="black"
      borderWidth="1px"
      _hover={
        viewerHasHearted
          ? {
              bg: "bg.subtle",
              borderColor: "teal.solid",
              color: "teal.fg",
            }
          : undefined
      }
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
