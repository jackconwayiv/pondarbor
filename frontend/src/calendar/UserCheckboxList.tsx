import { Box, Checkbox, HStack, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import {
  USER_COLOR_HEX,
  USER_COLOR_ORDER,
  type UserColorKey,
  colorForCheckedUser,
} from "./userColors";
import type { CalendarOwnerRow } from "./types";

type Props = {
  approvedUsers: CalendarOwnerRow[];
  /**
   * Currently checked user ids in the order they were checked. Position in
   * the list determines color via {@link colorForCheckedUser}.
   */
  orderedCheckedUserIds: number[];
  onChange: (next: number[]) => void;
  /** Optional max height for the scrollable list (default: full height). */
  maxHeight?: string | number;
};

/**
 * Vertical, scrollable list of approved users with a checkbox per row. Each
 * checked row gets a colored swatch matching the bar color used in the
 * calendar grid. A "Check all / Check none" toggle sits above the list.
 */
export default function UserCheckboxList({
  approvedUsers,
  orderedCheckedUserIds,
  onChange,
  maxHeight,
}: Props) {
  const allChecked =
    approvedUsers.length > 0 &&
    approvedUsers.every((u) => orderedCheckedUserIds.includes(u.id));
  const noneChecked = orderedCheckedUserIds.length === 0;
  const indeterminate = !allChecked && !noneChecked;

  const handleToggleAll = () => {
    if (allChecked) {
      onChange([]);
    } else {
      // Preserve any existing order at the front, then append unchecked
      // users in display order so newly-revealed ids get the next colors.
      const seen = new Set(orderedCheckedUserIds);
      const next = [...orderedCheckedUserIds];
      for (const u of approvedUsers) {
        if (!seen.has(u.id)) next.push(u.id);
      }
      onChange(next);
    }
  };

  const handleToggleUser = (userId: number, nextChecked: boolean) => {
    if (nextChecked) {
      if (orderedCheckedUserIds.includes(userId)) return;
      onChange([...orderedCheckedUserIds, userId]);
    } else {
      onChange(orderedCheckedUserIds.filter((id) => id !== userId));
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
      minW={{ base: "100%", md: "180px" }}
      maxW={{ base: "100%", md: "220px" }}
    >
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold" color="fg.muted">
        People
      </Text>
      <Checkbox.Root
        checked={allChecked ? true : indeterminate ? "indeterminate" : false}
        onCheckedChange={handleToggleAll}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
          {allChecked ? "Uncheck all" : "Check all"}
        </Checkbox.Label>
      </Checkbox.Root>
      <Box
        overflowY="auto"
        maxH={maxHeight ?? { base: "320px", md: "560px" }}
        pr="1"
        mt="1"
      >
        <Stack gap="1">
          {approvedUsers.map((u) => {
            const color = colorForCheckedUser(u.id, orderedCheckedUserIds);
            const checked = color !== null;
            return (
              <Checkbox.Root
                key={u.id}
                checked={checked}
                onCheckedChange={(d: { checked: boolean | "indeterminate" }) =>
                  handleToggleUser(u.id, Boolean(d.checked))
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
                    {u.display_name || u.email}
                  </Checkbox.Label>
                </HStack>
              </Checkbox.Root>
            );
          })}
          {approvedUsers.length === 0 ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              No approved users yet.
            </Text>
          ) : null}
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
