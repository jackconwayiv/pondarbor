import type { ReactNode } from "react";

import { CastleBrickBand } from "./CastleBrickBand";

export type RealmGridProps = {
  children: ReactNode;
};

/** Realm region: brick-wall band behind a 3x3 grid (corners + center occupied).
 * Brick band is a sibling of the grid so it spans the full realm-region width
 * independent of grid padding, and sits at a lower z-index so the Gate cell
 * appears in front of it. */
export function RealmGrid({ children }: RealmGridProps) {
  return (
    <>
      <CastleBrickBand />
      <div className="estates-realm-grid">{children}</div>
    </>
  );
}
