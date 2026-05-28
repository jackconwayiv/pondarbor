import { Button, HStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  energy: number;
  maxEnergy: number;
  onConfirm: () => void;
};

export default function PassEnergyConfirmModal({
  open,
  onOpenChange,
  energy,
  maxEnergy,
  onConfirm,
}: Props) {
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Pass with energy remaining?"
      description={`You have ${energy} of ${maxEnergy} energy left this turn.`}
      size="sm"
    >
      <HStack justify="flex-end" gap={2} pt={2}>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          colorPalette="orange"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Pass
        </Button>
      </HStack>
    </AppModal>
  );
}
