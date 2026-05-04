import { Box, Checkbox, HStack, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import {
  USER_COLOR_HEX,
  type UserColorKey,
  colorForCheckedUser,
} from "../calendar/userColors";

export type QuoteFilterOwnerRow = {
  id: number;
  label: string;
};

type Props = {
  owners: QuoteFilterOwnerRow[];
  orderedCheckedOwnerIds: number[];
  onChange: (next: number[]) => void;
  maxHeight?: string | number;
  /** When true, stretch to the container width (e.g. full-width toolbar panel). */
  wide?: boolean;
};

/**
 * Checkbox list of quote owners (from the current feed), matching the calendar
 * people filter pattern: check all / uncheck all plus per-row checkboxes with
 * color swatches in check order.
 */
export default function QuoteOwnerCheckboxList({
  owners,
  orderedCheckedOwnerIds,
  onChange,
  maxHeight,
  wide = false,
}: Props) {
  const allChecked =
    owners.length > 0 && owners.every((o) => orderedCheckedOwnerIds.includes(o.id));
  const noneChecked = orderedCheckedOwnerIds.length === 0;
  const indeterminate = !allChecked && !noneChecked;

  const handleToggleAll = () => {
    if (allChecked) {
      onChange([]);
    } else {
      const seen = new Set(orderedCheckedOwnerIds);
      const next = [...orderedCheckedOwnerIds];
      for (const o of owners) {
        if (!seen.has(o.id)) next.push(o.id);
      }
      onChange(next);
    }
  };

  const handleToggleOwner = (ownerId: number, nextChecked: boolean) => {
    if (nextChecked) {
      if (orderedCheckedOwnerIds.includes(ownerId)) return;
      onChange([...orderedCheckedOwnerIds, ownerId]);
    } else {
      onChange(orderedCheckedOwnerIds.filter((id) => id !== ownerId));
    }
  };

  return (
    <Stack
      gap="1"
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      p="2"
      w={wide ? "100%" : undefined}
      minW={wide ? "100%" : { base: "100%", md: "180px" }}
      maxW={wide ? "100%" : { base: "100%", md: "220px" }}
    >
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold" color="fg.muted">
        People
      </Text>
      <Checkbox.Root
        checked={allChecked ? true : indeterminate ? "indeterminate" : false}
        onCheckedChange={handleToggleAll}
        disabled={owners.length === 0}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
          {allChecked ? "Uncheck all" : "Check all"}
        </Checkbox.Label>
      </Checkbox.Root>
      <Box
        overflowY="auto"
        maxH={maxHeight ?? { base: "240px", md: "360px" }}
        pr="1"
        mt="1"
      >
        <Stack gap="1">
          {owners.map((o) => {
            const color = colorForCheckedUser(o.id, orderedCheckedOwnerIds);
            const checked = color !== null;
            return (
              <Checkbox.Root
                key={o.id}
                checked={checked}
                onCheckedChange={(d: { checked: boolean | "indeterminate" }) =>
                  handleToggleOwner(o.id, Boolean(d.checked))
                }
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <HStack gap="2" align="center" w="100%" minW="0">
                  <ColorSwatch color={color} />
                  <Checkbox.Label
                    fontSize={APP_TEXT_SIZES.helper}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {o.label}
                  </Checkbox.Label>
                </HStack>
              </Checkbox.Root>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
}

function ColorSwatch({ color }: { color: UserColorKey | null }) {
  if (color === null) {
    return (
      <Box
        w="3"
        h="3"
        borderRadius="sm"
        borderWidth="1px"
        borderColor="border"
        bg="transparent"
        flexShrink="0"
      />
    );
  }
  return (
    <Box
      w="3"
      h="3"
      borderRadius="sm"
      borderWidth="1px"
      borderColor="border"
      style={{ background: USER_COLOR_HEX[color] }}
      flexShrink="0"
    />
  );
}
