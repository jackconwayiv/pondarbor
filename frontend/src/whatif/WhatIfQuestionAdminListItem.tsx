import { Box, HStack, Stack, Switch, Tabs, Text } from "@chakra-ui/react";
import type { RefObject } from "react";

import PondButton from "../PondButton";
import { MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import type { WhatIfQuestionAdmin } from "./api";
import { WhatIfQuestionAdminListMeta } from "./WhatIfQuestionAdminListMeta";

export type WhatIfQuestionAdminListItemProps = {
  q: WhatIfQuestionAdmin;
  busy: boolean;
  confirmDeleteId: number | null;
  confirmDeleteButtonRef: RefObject<HTMLButtonElement | null>;
  onEdit: (q: WhatIfQuestionAdmin) => void;
  onDeleteClick: (q: WhatIfQuestionAdmin) => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onToggleActive: (id: number, is_active: boolean) => void | Promise<void>;
};

export function WhatIfQuestionAdminListItem({
  q,
  busy,
  confirmDeleteId,
  confirmDeleteButtonRef,
  onEdit,
  onDeleteClick,
  onApprove,
  onReject,
  onToggleActive,
}: WhatIfQuestionAdminListItemProps) {
  const statusLabel =
    q.review_status === "pending"
      ? "(pending)"
      : q.review_status === "rejected"
        ? "(rejected)"
        : !q.is_active
          ? "(inactive)"
          : "";

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      {...MAPPED_LIST_CARD_OUTER_PROPS}
    >
      <Tabs.Root
        id={`whatif-admin-q-${q.id}`}
        defaultValue="question"
        variant="plain"
      >
        <Tabs.List
          borderBottomWidth="1px"
          borderColor="border"
          w="100%"
          justifyContent="flex-end"
          gap="1"
        >
          <Tabs.Trigger
            value="question"
            px="2"
            py="2"
            fontWeight="medium"
            borderTopRadius="md"
            borderBottomRadius="0"
            _selected={{ bg: "lilypad.solid", color: "black" }}
          >
            Question
          </Tabs.Trigger>
          <Tabs.Trigger
            value="metadata"
            px="2"
            py="2"
            fontWeight="medium"
            borderTopRadius="md"
            borderBottomRadius="0"
            _selected={{ bg: "lilypad.solid", color: "black" }}
          >
            Metadata
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="question" pt="2">
          <Stack gap="3">
            <Text whiteSpace="pre-wrap">
              {`#${q.id}${statusLabel ? ` ${statusLabel}` : ""}: ${q.prompt}`}
            </Text>
            <Text fontSize="sm" color="gray.700">
              1) {q.answer_1} | 2) {q.answer_2} | 3) {q.answer_3} | 4){" "}
              {q.answer_4} | 5) {q.answer_5} | 6) {q.answer_6}
            </Text>
            <HStack
              gap="3"
              flexWrap="wrap"
              justify="space-between"
              w="100%"
              align="center"
            >
              <HStack gap="2" flexWrap="wrap" align="center" flexShrink={0}>
                <PondButton
                  type="button"
                  colorPalette="lilypad"
                  onClick={() => onEdit(q)}
                >
                  Edit
                </PondButton>
                {q.review_status === "pending" ? (
                  <>
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      size="sm"
                      loading={busy}
                      onClick={() => onApprove?.(q.id)}
                    >
                      Approve
                    </PondButton>
                    <PondButton
                      type="button"
                      variant="outline"
                      colorPalette="orange"
                      size="sm"
                      loading={busy}
                      onClick={() => onReject?.(q.id)}
                    >
                      Reject
                    </PondButton>
                  </>
                ) : null}
              </HStack>
              <HStack
                gap="3"
                flexWrap="wrap"
                align="center"
                justify="flex-end"
                flexShrink={0}
                ml="auto"
              >
                <Switch.Root
                  checked={q.is_active}
                  onCheckedChange={(details) => {
                    if (busy) return;
                    void onToggleActive(q.id, details.checked);
                  }}
                  disabled={busy}
                  colorPalette="lilypad"
                  size="md"
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Label fontSize="sm" fontWeight="medium">
                    Active (eligible for draws)
                  </Switch.Label>
                </Switch.Root>
                <PondButton
                  type="button"
                  colorPalette="orange"
                  ref={
                    confirmDeleteId === q.id
                      ? confirmDeleteButtonRef
                      : undefined
                  }
                  onClick={() => onDeleteClick(q)}
                  loading={busy && confirmDeleteId === q.id}
                >
                  {confirmDeleteId === q.id ? "Confirm Delete" : "Delete"}
                </PondButton>
              </HStack>
            </HStack>
          </Stack>
        </Tabs.Content>
        <Tabs.Content value="metadata" pt="2">
          <WhatIfQuestionAdminListMeta q={q} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
