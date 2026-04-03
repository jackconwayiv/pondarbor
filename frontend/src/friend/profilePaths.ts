/** Canonical shareable path for a friend’s public profile (no email in the URL). */
export function friendProfilePath(userId: number): string {
  return `/friend/${userId}`;
}
