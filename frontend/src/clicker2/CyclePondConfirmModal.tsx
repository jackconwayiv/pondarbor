import { Button, List, Stack, Text } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";

import {
  CYCLE_POND_CONFIRM_BODY,
  CYCLE_POND_CONFIRM_FOSSILIZE,
  CYCLE_POND_CONFIRM_GAIN,
  CYCLE_POND_CONFIRM_KEEP,
  CYCLE_POND_CONFIRM_RESET,
  CYCLE_POND_CONFIRM_TITLE,
  CYCLE_POND_CYCLE_BUTTON,
  CYCLE_POND_NOT_YET_BUTTON,
  stratumCountHeading,
} from "./clicker2Copy";

export default function CyclePondConfirmModal({
  open,
  onOpenChange,
  unfossilizedStrata,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unfossilizedStrata: number;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={CYCLE_POND_CONFIRM_TITLE}
      size="sm"
    >
      <Stack gap="3">
        <Text fontSize="sm" color="gray.700" lineHeight="1.5">
          {CYCLE_POND_CONFIRM_BODY}
        </Text>
        <Text fontSize="sm" fontWeight="semibold" color="lilypad.emphasized">
          {CYCLE_POND_CONFIRM_FOSSILIZE(unfossilizedStrata)}
        </Text>
        <Stack gap="1">
          <Text fontSize="xs" fontWeight="bold" color="gray.600">
            {CYCLE_POND_CONFIRM_RESET}
          </Text>
          <List.Root fontSize="xs" color="gray.600" ps="4" gap="0.5">
            <List.Item>All your current energy from this cycle</List.Item>
            <List.Item>All your purchased denizens and evolutions</List.Item>
            <List.Item>Your current mutation and weather timers</List.Item>
          </List.Root>
        </Stack>
        <Stack gap="1">
          <Text fontSize="xs" fontWeight="bold" color="gray.600">
            {CYCLE_POND_CONFIRM_KEEP}
          </Text>
          <List.Root fontSize="xs" color="gray.600" ps="4" gap="0.5">
            <List.Item>All Fossil Shop purchases</List.Item>
            <List.Item>Fossilized strata, unspent fossils</List.Item>
            <List.Item>Milestones and blossoms acquired</List.Item>
            <List.Item>Mutation levels and unspent mutagens</List.Item>
          </List.Root>
        </Stack>
        <Stack gap="1">
          <Text fontSize="xs" fontWeight="bold" color="gray.600">
            {CYCLE_POND_CONFIRM_GAIN}
          </Text>
          <List.Root fontSize="xs" color="gray.600" ps="4" gap="0.5">
          <List.Item>
              {stratumCountHeading(unfossilizedStrata)} become fossilized (+1
              fossil each)
            </List.Item>
            <List.Item>Access to permanent Fossil Shop purchases</List.Item>
          </List.Root>
        </Stack>
        <Stack direction="row" gap="2" justify="flex-end" pt="1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {CYCLE_POND_NOT_YET_BUTTON}
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
            {CYCLE_POND_CYCLE_BUTTON}
          </Button>
        </Stack>
      </Stack>
    </AppModal>
  );
}
