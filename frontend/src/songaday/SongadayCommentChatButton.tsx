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
  return (
    <PondButton
      type="button"
      variant="outline"
      colorPalette="teal"
      bg="white"
      color="black"
      borderWidth="1px"
      disabled={busy}
      aria-expanded={expanded ?? undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <HStack gap="1">
        <Text as="span">💬</Text>
        {!hideCount && commentCount > 0 ? <Text as="span">{commentCount}</Text> : null}
      </HStack>
    </PondButton>
  );
}
