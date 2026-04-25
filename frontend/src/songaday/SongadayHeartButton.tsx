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
  const selected = viewerHasHearted;
  return (
    <PondButton
      type="button"
      size="sm"
      variant="ghost"
      colorPalette="navy"
      bg={selected ? "navy.solid" : "bg.panel"}
      color={selected ? "navy.contrast" : "navy.solid"}
      borderWidth="0"
      _hover={{
        bg: selected ? "navy.emphasized" : "bg.subtle",
      }}
      disabled={disabled || busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={selected}
    >
      <HStack gap="1">
        <Text as="span" opacity={selected ? 1 : 0.85}>
          ❤️
        </Text>
        {heartCount > 0 ? (
          <Text as="span">{heartCount}</Text>
        ) : null}
      </HStack>
    </PondButton>
  );
}
