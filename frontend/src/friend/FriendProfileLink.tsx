import type { CSSProperties, ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import { friendProfilePath } from "./profilePaths";

type FriendProfileLinkProps = {
  userId: number;
  children: ReactNode;
  className?: string;
};

/**
 * Link to a friend profile. Stops propagation so parent card click handlers (e.g. open editor) do not run.
 */
/** Keeps chip/tag siblings aligned; no default anchor underline on profile links in quote cards. */
const linkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1,
  textDecoration: "none",
};

export default function FriendProfileLink({ userId, children, className }: FriendProfileLinkProps) {
  const mergedClass = [className, "friend-profile-link"].filter(Boolean).join(" ");
  return (
    <RouterLink
      to={friendProfilePath(userId)}
      className={mergedClass || undefined}
      style={linkStyle}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {children}
    </RouterLink>
  );
}
