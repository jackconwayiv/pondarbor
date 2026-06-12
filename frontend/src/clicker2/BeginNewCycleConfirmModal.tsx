import { Button, Stack, Text } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";

import {
  BEGIN_NEW_CYCLE_CANCEL_BUTTON,
  BEGIN_NEW_CYCLE_CONFIRM_BODY,
  BEGIN_NEW_CYCLE_CONFIRM_BUTTON,
  BEGIN_NEW_CYCLE_CONFIRM_TITLE,
} from "./clicker2Copy";

export default function BeginNewCycleConfirmModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={BEGIN_NEW_CYCLE_CONFIRM_TITLE}
      size="sm"
    >
      <Stack gap="3">
        <Text fontSize="sm" color="gray.700" lineHeight="1.5">
          {BEGIN_NEW_CYCLE_CONFIRM_BODY}
        </Text>
        <Stack direction="row" gap="2" justify="flex-end" pt="1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {BEGIN_NEW_CYCLE_CANCEL_BUTTON}
          </Button>
          <Button
            type="button"
            size="sm"
            colorPalette="teal"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {BEGIN_NEW_CYCLE_CONFIRM_BUTTON}
          </Button>
        </Stack>
      </Stack>
    </AppModal>
  );
}
