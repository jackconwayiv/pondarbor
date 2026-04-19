import { Box, Heading, Table, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import {
  dmDeleteIneffectiveInput,
  dmFetchIneffectiveInputs,
  type DmIneffectiveInputRow,
} from "./api";

export default function QffDmIneffectiveInputsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmIneffectiveInputRow[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await dmFetchIneffectiveInputs(token, { limit: 200 });
    setRows(data.results);
    setTotal(data.count);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    setErr(null);
    load().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [isAuthenticated, isStaff, load]);

  async function handleDelete(id: number) {
    setErr(null);
    setDeletingId(id);
    try {
      const token = await getApiAccessToken();
      await dmDeleteIneffectiveInput(token, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <Box maxW="5xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return (
      <Box maxW="5xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return (
    <Box maxW="5xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={2}>
        Ineffective commands
      </Heading>
      <Text mb={4} color="#889977" fontSize="sm">
        Lines the parser treated as unknown (“You try that, but nothing happens.”). Newest first.
        {total > 0 ? ` Showing ${rows.length} of ${total}.` : null}
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
        </Text>
      )}
      <QffButton onClick={() => navigate("/qff/dm")} mb={6}>
        ← DM home
      </QffButton>
      {rows.length === 0 ? (
        <Text color="#889977">No rows yet.</Text>
      ) : (
        <Box overflowX="auto">
          <Table.Root size="sm" variant="line">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Time (UTC)</Table.ColumnHeader>
                <Table.ColumnHeader>Email</Table.ColumnHeader>
                <Table.ColumnHeader>Input</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right">
                  {/* delete */}
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell whiteSpace="nowrap" color="#889977">
                    {r.created_at.replace("T", " ").replace(/\.\d+Z$/, " Z")}
                  </Table.Cell>
                  <Table.Cell>{r.user_email}</Table.Cell>
                  <Table.Cell fontFamily="mono" fontSize="xs">
                    {r.raw_line}
                  </Table.Cell>
                  <Table.Cell textAlign="right">
                    <QffButton
                      type="button"
                      size="sm"
                      colorPalette="red"
                      loading={deletingId === r.id}
                      onClick={() => void handleDelete(r.id)}
                    >
                      Delete
                    </QffButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  );
}
