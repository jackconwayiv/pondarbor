import { HStack, Text } from "@chakra-ui/react";

import PondButton from "../PondButton";

type Props = {
  commentCount: number;
  busy?: boolean;
  /** Toggles inline comment panel open/closed. */
  onToggle: () => void;
  expanded?: boolean;
  /** When true, only the 💬 icon (e.g. own card — count lives in the header). */
  hideCount?: boolean;
};

/** Friend row: toggles inline comment thread (mirrors heart button layout). */
export default function SongadayCommentChatButton({
  commentCount,
  busy,
  onToggle,
  expanded,
  hideCount,
}: Props) {
  const selected = Boolean(expanded);
  return (
    <PondButton
      type="button"
      variant="ghost"
      colorPalette="navy"
      bg={selected ? "navy.solid" : "bg.panel"}
      color={selected ? "navy.contrast" : "navy.solid"}
      borderWidth="0"
      _hover={{
        bg: selected ? "navy.emphasized" : "bg.subtle",
      }}
      disabled={busy}
      aria-expanded={expanded ?? undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <HStack gap="1">
        <Text as="span" opacity={selected ? 1 : 0.85}>
          💬
        </Text>
        {!hideCount && commentCount > 0 ? <Text as="span">{commentCount}</Text> : null}
      </HStack>
    </PondButton>
  );
}
