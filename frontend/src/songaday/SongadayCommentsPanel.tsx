import { Box, HStack, Image, Stack, Text, Textarea } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  deleteFriendComment,
  fetchFriendComments,
  patchFriendComment,
  postFriendComment,
} from "../friend-comments/api";
import type { FriendCommentRow } from "../friend-comments/api";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { SongadayUserRow } from "./types";

function avatarInitial(label: string) {
  return label.slice(0, 1).toUpperCase();
}

function CommentAvatar({ user }: { user: SongadayUserRow }) {
  const [failed, setFailed] = useState(false);
  const src = (user.avatar_url || "").trim();
  const label = user.nickname || user.email.split("@")[0];
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) {
    return (
      <Stack
        boxSize="32px"
        borderRadius="full"
        bg="gray.200"
        alignItems="center"
        justifyContent="center"
        fontWeight="bold"
        flexShrink={0}
        fontSize="sm"
      >
        {avatarInitial(label)}
      </Stack>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      boxSize="32px"
      borderRadius="full"
      objectFit="cover"
      flexShrink={0}
      onError={() => setFailed(true)}
    />
  );
}

type Props = {
  getAccessToken: () => Promise<string>;
  responseId: number;
  myUserId: number;
  ownerNotes: string;
  /** When false, omit the notes block (e.g. card already shows the note). */
  showOwnerNotesBlock?: boolean;
  /** Label for the notes block when shown. */
  ownerNotesLabel?: string;
  maxListHeight?: string;
  onCommentCountChanged?: (count: number) => void;
  /**
   * When true (e.g. viewing your own submission), hide the compose area until at least one
   * comment exists from someone other than the signed-in user.
   */
  hideComposeUntilCommentFromOther?: boolean;
  /**
   * When set (e.g. friend card), render this between the comment list and the compose form.
   * Use with `composeExpanded` so the form toggles independently of the always-visible list.
   */
  middleSlot?: ReactNode;
  /**
   * When `middleSlot` is set: controls visibility of the compose area only (list stays mounted).
   * Ignored when `middleSlot` is absent.
   */
  composeExpanded?: boolean;
  /** Called after a new comment is posted successfully (e.g. collapse inline compose on Song-a-Day cards). */
  onCommentPosted?: () => void;
};

export default function SongadayCommentsPanel({
  getAccessToken,
  responseId,
  myUserId,
  ownerNotes,
  showOwnerNotesBlock = true,
  ownerNotesLabel = "Note",
  maxListHeight,
  onCommentCountChanged,
  hideComposeUntilCommentFromOther = false,
  middleSlot,
  composeExpanded = true,
  onCommentPosted,
}: Props) {
  const [rows, setRows] = useState<FriendCommentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmRef = useRef<HTMLDivElement | null>(null);
  /** Parent often passes an inline handler; keep out of `load` deps to avoid refetch loops. */
  const onCommentCountChangedRef = useRef(onCommentCountChanged);
  onCommentCountChangedRef.current = onCommentCountChanged;
  const onCommentPostedRef = useRef(onCommentPosted);
  onCommentPostedRef.current = onCommentPosted;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getAccessToken();
      const list = await fetchFriendComments(token, responseId);
      setRows(list);
      onCommentCountChangedRef.current?.(list.length);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load comments.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, responseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (confirmDeleteId == null) return;
    const onDocDown = (ev: Event) => {
      const el = confirmRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [confirmDeleteId]);

  const onPost = async () => {
    const body = compose.trim();
    if (!body) return;
    setPostBusy(true);
    try {
      const token = await getAccessToken();
      const row = await postFriendComment(token, responseId, body);
      setCompose("");
      setRows((prev) => {
        const next = [...prev, row];
        queueMicrotask(() => onCommentCountChangedRef.current?.(next.length));
        return next;
      });
      onCommentPostedRef.current?.();
    } catch {
      /* ignore */
    } finally {
      setPostBusy(false);
    }
  };

  const startEdit = (r: FriendCommentRow) => {
    setEditingId(r.id);
    setEditBody(r.body);
    setConfirmDeleteId(null);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const body = editBody.trim();
    if (!body) return;
    setEditBusy(true);
    try {
      const token = await getAccessToken();
      const updated = await patchFriendComment(token, editingId, body);
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingId(null);
    } catch {
      /* ignore */
    } finally {
      setEditBusy(false);
    }
  };

  const doDelete = async (id: number) => {
    try {
      const token = await getAccessToken();
      await deleteFriendComment(token, id);
      setRows((prev) => {
        const next = prev.filter((x) => x.id !== id);
        queueMicrotask(() => onCommentCountChangedRef.current?.(next.length));
        return next;
      });
      setConfirmDeleteId(null);
    } catch {
      /* ignore */
    }
  };

  const notesTrim = ownerNotes.trim();

  const hasCommentFromSomeoneElse = rows.some((r) => r.author.id !== myUserId);
  const showCompose =
    !hideComposeUntilCommentFromOther ||
    (!loading && hasCommentFromSomeoneElse);

  const splitMode = middleSlot != null;
  const showListStack =
    !loading &&
    (splitMode ? rows.length > 0 : true);

  const commentList = showListStack ? (
    <Stack
      gap="2"
      maxH={maxListHeight}
      overflowY={maxListHeight ? "auto" : undefined}
      pr={maxListHeight ? "1" : undefined}
    >
      {rows.map((r) => (
        <HStack key={r.id} align="flex-start" gap="2" w="full">
          <CommentAvatar user={r.author} />
          <Stack gap="1" flex="1" minW={0} align="stretch">
            {editingId === r.id ? (
              <Stack gap="2">
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                />
                <PondButton
                  type="button"
                  size="sm"
                  colorPalette="lilypad"
                  loading={editBusy}
                  disabled={editBusy}
                  onClick={() => void saveEdit()}
                >
                  Save
                </PondButton>
              </Stack>
            ) : (
              <>
                <Text whiteSpace="pre-wrap" fontSize={APP_TEXT_SIZES.body} lineHeight="tall">
                  {r.body}
                  {r.edited ? (
                    <Text as="span" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      {" "}
                      (edited)
                    </Text>
                  ) : null}
                </Text>
                {r.author.id === myUserId ? (
                  <HStack gap="3" ref={r.id === confirmDeleteId ? confirmRef : undefined}>
                    <Text
                      as="button"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="teal.solid"
                      textDecoration="underline"
                      onClick={() => startEdit(r)}
                    >
                      Edit
                    </Text>
                    {confirmDeleteId === r.id ? (
                      <Text
                        as="button"
                        fontSize={APP_TEXT_SIZES.helper}
                        color="nautical.solid"
                        fontWeight="semibold"
                        textDecoration="underline"
                        onClick={() => void doDelete(r.id)}
                      >
                        Confirm Delete
                      </Text>
                    ) : (
                      <Text
                        as="button"
                        fontSize={APP_TEXT_SIZES.helper}
                        color="nautical.solid"
                        textDecoration="underline"
                        onClick={() => {
                          setConfirmDeleteId(r.id);
                          setEditingId(null);
                        }}
                      >
                        Delete
                      </Text>
                    )}
                  </HStack>
                ) : null}
              </>
            )}
          </Stack>
        </HStack>
      ))}
    </Stack>
  ) : null;

  const showComposeArea =
    showCompose && (splitMode ? composeExpanded : true);

  return (
    <Stack gap="3" align="stretch" w="full">
      {showOwnerNotesBlock && notesTrim ? (
        <Box bg="gray.50" w="full" {...PANEL_NESTED_BLOCK_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.meta} fontWeight="bold" mb="1">
            {ownerNotesLabel}
          </Text>
          <Text whiteSpace="pre-wrap" fontSize={APP_TEXT_SIZES.body} lineHeight="tall">
            {notesTrim}
          </Text>
        </Box>
      ) : null}

      {loadError ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
          {loadError}
        </Text>
      ) : null}
      {loading ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Loading comments…
        </Text>
      ) : (
        commentList
      )}

      {splitMode ? middleSlot : null}

      {showComposeArea ? (
        <Stack gap="2">
          <Textarea
            placeholder="Write a comment…"
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
            rows={3}
          />
          <PondButton
            type="button"
            size="sm"
            colorPalette="lilypad"
            loading={postBusy}
            disabled={postBusy || !compose.trim()}
            onClick={() => void onPost()}
          >
            Comment
          </PondButton>
        </Stack>
      ) : null}
    </Stack>
  );
}
