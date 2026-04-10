import type { BorrowRequest, ClosetItem } from "./types";
import { displayName } from "./closetUtils";

export type CustodyFriendOption = { id: number; label: string };

export function computeOrderedCustodyFriends(
  custodyFriends: CustodyFriendOption[],
  item: ClosetItem,
  pendingRows: BorrowRequest[],
): { prioritized: CustodyFriendOption[]; rest: CustodyFriendOption[] } {
  const byId = new Map(custodyFriends.map((f) => [f.id, f]));
  const prioritizedIds: number[] = [];
  const pendingAssignee = item.pending_custody_user;
  if (pendingAssignee && pendingAssignee.id !== item.owner_user.id) {
    prioritizedIds.push(pendingAssignee.id);
  }
  if (
    item.current_holder_user.id !== item.owner_user.id &&
    !prioritizedIds.includes(item.current_holder_user.id)
  ) {
    prioritizedIds.push(item.current_holder_user.id);
  }
  for (const row of pendingRows) {
    if (!byId.has(row.requester_user.id)) continue;
    if (prioritizedIds.includes(row.requester_user.id)) continue;
    prioritizedIds.push(row.requester_user.id);
  }

  const labelForId = (id: number): string => {
    const f = byId.get(id);
    if (f) return f.label;
    if (pendingAssignee && id === pendingAssignee.id)
      return displayName(pendingAssignee);
    if (id === item.current_holder_user.id)
      return displayName(item.current_holder_user);
    return String(id);
  };

  const prioritized = prioritizedIds.map((id) => {
    const f = byId.get(id);
    if (f) return f;
    return { id, label: labelForId(id) };
  });
  const rest = custodyFriends.filter((f) => !prioritizedIds.includes(f.id));
  return { prioritized, rest };
}
