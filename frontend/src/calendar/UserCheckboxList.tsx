import { Avatar, Box, Checkbox, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  PanelEmptyState,
  PanelErrorState,
  PanelListRowSkeleton,
} from "../components/panelStatus";
import {
  USER_COLOR_HEX,
  type UserColorKey,
  colorForCheckedUser,
} from "./userColors";
import type { CalendarOwnerRow } from "./types";

type Props = {
  approvedUsers: CalendarOwnerRow[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  /**
   * Currently checked user ids. For color markers, swatches follow
   * {@link approvedUsers} display order.
   */
  orderedCheckedUserIds: number[];
  onChange: (next: number[]) => void;
  /** Color swatch (calendar) or avatar (books). Default: color. */
  rowMarker?: "color" | "avatar";
  /** Optional max height for the scrollable list (default: full height). */
  maxHeight?: string | number;
  onExport?: () => void;
  exportDisabled?: boolean;
};

/**
 * Vertical, scrollable list of approved users with a checkbox per row.
 * Calendar rows use a stable color swatch; books rows can show avatars instead.
 * A "Check all / Check none" toggle sits above the list.
 */
export default function UserCheckboxList({
  approvedUsers,
  loading,
  error,
  onRefresh,
  orderedCheckedUserIds,
  onChange,
  rowMarker = "color",
  maxHeight,
  onExport,
  exportDisabled,
}: Props) {
  const allChecked =
    approvedUsers.length > 0 &&
    approvedUsers.every((u) => orderedCheckedUserIds.includes(u.id));
  const noneChecked = orderedCheckedUserIds.length === 0;
  const indeterminate = !allChecked && !noneChecked;
  const colorUserIds = approvedUsers.map((u) => u.id);

  const handleToggleAll = () => {
    if (allChecked) {
      onChange([]);
    } else {
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
      <HStack justify="space-between" align="center" gap="2">
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold" color="fg.muted">
          People
        </Text>
        {onExport ? (
          <PondButton
            size="xs"
            colorPalette="sky"
            variant="outline"
            onClick={onExport}
            disabled={exportDisabled}
          >
            Export
          </PondButton>
        ) : null}
      </HStack>
      {!error ? (
        <Checkbox.Root
          checked={allChecked ? true : indeterminate ? "indeterminate" : false}
          onCheckedChange={handleToggleAll}
          disabled={!!loading || approvedUsers.length === 0}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            {allChecked ? "Uncheck all" : "Check all"}
          </Checkbox.Label>
        </Checkbox.Root>
      ) : null}
      <Box
        overflowY="auto"
        maxH={maxHeight ?? { base: "320px", md: "560px" }}
        pr="1"
        mt="1"
      >
        <Stack gap="1">
          {error ? (
            <PanelErrorState
              title="Could not load people."
              description={error}
              actionLabel="Refresh"
              onAction={onRefresh}
            />
          ) : loading && approvedUsers.length === 0 ? (
            <PanelListRowSkeleton rows={6} />
          ) : null}
          <SimpleGrid columns={{ base: 2, md: 1 }} gap="1" w="100%">
            {approvedUsers.map((u) => {
              const checked = orderedCheckedUserIds.includes(u.id);
              const color =
                rowMarker === "color"
                  ? colorForCheckedUser(u.id, orderedCheckedUserIds, colorUserIds)
                  : null;
              return (
                <Checkbox.Root
                  key={u.id}
                  checked={checked}
                  minW="0"
                  onCheckedChange={(d: { checked: boolean | "indeterminate" }) =>
                    handleToggleUser(u.id, Boolean(d.checked))
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <HStack gap="2" align="center" w="100%" minW="0">
                    {rowMarker === "avatar" ? (
                      <Avatar.Root size="xs" flexShrink={0}>
                        {u.avatar_url ? <Avatar.Image src={u.avatar_url} alt="" /> : null}
                        <Avatar.Fallback name={u.display_name} />
                      </Avatar.Root>
                    ) : (
                      <ColorSwatch color={color} />
                    )}
                    <Checkbox.Label
                      fontSize={APP_TEXT_SIZES.helper}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {u.display_name}
                    </Checkbox.Label>
                  </HStack>
                </Checkbox.Root>
              );
            })}
          </SimpleGrid>
          {!loading && !error && approvedUsers.length === 0 ? (
            <PanelEmptyState
              title="No approved users yet."
              description="Once more friends are approved, you’ll be able to add them as sources."
            />
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
