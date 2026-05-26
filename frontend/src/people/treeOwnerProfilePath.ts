import { friendProfilePath } from "../friend/profilePaths";

/** Profile URL for the Pond user who owns the family tree being viewed. */
export function treeOwnerProfilePath(
  treeOwnerUserId: number,
  viewerUserId: number | undefined,
): string {
  if (viewerUserId != null && treeOwnerUserId === viewerUserId) {
    return "/profile";
  }
  return friendProfilePath(treeOwnerUserId);
}
