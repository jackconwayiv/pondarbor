import {
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import type { OwnerQuery } from "./api";
import type { CalendarOwnerRow } from "./types";

type Props = {
  value: OwnerQuery;
  onChange: (next: OwnerQuery) => void;
  approvedUsers: CalendarOwnerRow[];
  currentUserId: number | null;
};

/**
 * Dropdown for "All approved" / "Just me" / a specific approved user.
 * Uses a native select + a search input; behaves well with many users without
 * pulling in a heavy combobox component.
 */
export default function OwnerFilter({
  value,
  onChange,
  approvedUsers,
  currentUserId,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return approvedUsers;
    return approvedUsers.filter((u) => {
      const label = `${u.display_name} ${u.email}`.toLowerCase();
      return label.includes(q);
    });
  }, [approvedUsers, query]);

  // If the current selection falls out of the filtered list after a query,
  // revert to "all" so the dropdown value stays valid.
  useEffect(() => {
    if (typeof value !== "number") return;
    if (!filtered.some((u) => u.id === value)) {
      onChange("all");
    }
  }, [filtered, onChange, value]);

  const selectValue = typeof value === "number" ? String(value) : value;

  return (
    <Stack gap="1">
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
        Whose events
      </Text>
      <HStack gap="2" align="stretch" flexWrap="wrap">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          maxW={{ base: "100%", md: "200px" }}
          {...PANEL_FIELD_PROPS}
        />
        <NativeSelectRoot maxW={{ base: "100%", md: "260px" }} flex="1">
          <NativeSelectField
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "me" || v === "all") {
                onChange(v);
              } else {
                const n = Number(v);
                if (Number.isFinite(n)) onChange(n);
              }
            }}
          >
            <option value="all">All approved users</option>
            {currentUserId !== null ? <option value="me">Just me</option> : null}
            {filtered
              .filter((u) => u.id !== currentUserId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.email}
                </option>
              ))}
          </NativeSelectField>
        </NativeSelectRoot>
      </HStack>
    </Stack>
  );
}
