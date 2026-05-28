import { Button, HStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export default function RestartAdventureConfirmModal({
  open,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Start a new adventure?"
      description="Your current progress will be erased."
      size="sm"
    >
      <HStack justify="flex-end" gap={2} pt={2}>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          colorPalette="red"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Restart
        </Button>
      </HStack>
    </AppModal>
  );
}
