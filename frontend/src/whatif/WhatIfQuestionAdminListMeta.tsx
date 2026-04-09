import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import type { WhatIfQuestionAdmin } from "./api";

function fmtRatio(n: number, d: number, digits: number): string {
  if (d <= 0 || !Number.isFinite(n / d)) return "—";
  return (n / d).toFixed(digits);
}

function fmtPct(n: number, d: number): string {
  if (d <= 0 || !Number.isFinite(n / d)) return "—";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function countNonEmptyAnswers(q: WhatIfQuestionAdmin): number {
  return [
    q.answer_1,
    q.answer_2,
    q.answer_3,
    q.answer_4,
    q.answer_5,
    q.answer_6,
  ].filter((s) => (s ?? "").trim().length > 0).length;
}

type WhatIfQuestionAdminListMetaProps = {
  q: WhatIfQuestionAdmin;
};

/**
 * Explains fields from WhatIfQuestion: sessions_used_count, total_responses, total_scores, total_skips.
 */
export function WhatIfQuestionAdminListMeta({
  q,
}: WhatIfQuestionAdminListMetaProps) {
  const draws = q.sessions_used_count;
  const votes = q.total_responses;
  const skips = q.total_skips;
  const scoreEntries = q.total_scores;
  const filledOptions = countNonEmptyAnswers(q);

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      px="2"
      py="2"
      bg="bg.muted"
    >
      <Stack gap="2">
        <SimpleGrid
          columns={{ base: 1, sm: 2 }}
          gap="2"
          fontSize="sm"
          color="gray.800"
        >
          <Text>
            <Text as="span" fontWeight="semibold">
              Times drawn:{" "}
            </Text>
            {draws}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Player votes (all sessions):{" "}
            </Text>
            {votes}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Skips / vetoes recorded:{" "}
            </Text>
            {skips}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Scoring entries at reveal:{" "}
            </Text>
            {scoreEntries}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Answer options filled:{" "}
            </Text>
            {filledOptions} / 6
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Avg votes per draw:{" "}
            </Text>
            {draws > 0 ? fmtRatio(votes, draws, 1) : "—"}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Skips per draw:{" "}
            </Text>
            {draws > 0 ? fmtRatio(skips, draws, 2) : "—"}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Scoring density:{" "}
            </Text>
            {fmtPct(scoreEntries, votes)}
            {votes > 0
              ? ` (${fmtRatio(scoreEntries, votes, 2)} entries per vote)`
              : ""}
          </Text>
        </SimpleGrid>
        <Stack gap="0.5" fontSize="xs" color="gray.600">
          <Text>
            &quot;Player votes&quot; increments for each vote cast on this
            question. &quot;Scoring entries at reveal&quot; adds the number of
            players who received points each time votes are revealed (not total
            points).
          </Text>
          <Text>
            Proposed by user id: {q.proposed_by ?? "—"} · Created:{" "}
            {q.created_at ? new Date(q.created_at).toLocaleString() : "—"} ·
            Updated:{" "}
            {q.updated_at ? new Date(q.updated_at).toLocaleString() : "—"}
            {q.deleted_at
              ? ` · Deleted: ${new Date(q.deleted_at).toLocaleString()}`
              : ""}
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
