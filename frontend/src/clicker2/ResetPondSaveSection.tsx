import { Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import PondButton from "../PondButton";

import {
  RESET_POND_BUTTON,
  RESET_POND_CANNOT_UNDO,
  RESET_POND_CONFIRM_BUTTON,
  RESET_POND_SECTION_TITLE,
  RESET_POND_WARNING,
} from "./clicker2Copy";

export default function ResetPondSaveSection({
  busy,
  error,
  onReset,
}: {
  busy: boolean;
  error: string | null;
  onReset: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const onPointerDown = (e: PointerEvent) => {
      const btn = confirmButtonRef.current;
      if (btn && e.target instanceof Node && btn.contains(e.target)) return;
      setConfirming(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [confirming]);

  return (
    <Stack
      gap="2"
      pt="2"
      mt="0.5"
      borderTopWidth="1px"
      borderColor="border"
    >
      <Text fontSize="xs" fontWeight="semibold" color="gray.700">
        {RESET_POND_SECTION_TITLE}
      </Text>
      <Text fontSize="xs" color="gray.600" lineHeight="1.45">
        {RESET_POND_WARNING}
      </Text>
      <Text fontSize="xs" fontWeight="medium" color="nautical.solid" lineHeight="1.4">
        {RESET_POND_CANNOT_UNDO}
      </Text>
      {error ? (
        <Text
          role="alert"
          fontSize="xs"
          color="nautical.solid"
          fontWeight="medium"
          lineHeight="1.4"
        >
          {error}
        </Text>
      ) : null}
      <PondButton
        ref={confirmButtonRef}
        type="button"
        size="sm"
        colorPalette="orange"
        alignSelf="flex-end"
        loading={busy}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          if (!confirming) {
            setConfirming(true);
            return;
          }
          void onReset();
        }}
      >
        {confirming ? RESET_POND_CONFIRM_BUTTON : RESET_POND_BUTTON}
      </PondButton>
    </Stack>
  );
}
