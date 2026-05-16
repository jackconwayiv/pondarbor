export type Point = { x: number; y: number };

export type PersonAnchor = {
  top: Point;
  bottom: Point;
  center: Point;
  left: Point;
  right: Point;
};

/** Orthogonal parent → child path with a shared midline. */
export function parentChildPath(from: Point, to: Point): string {
  const midY = from.y + (to.y - from.y) * 0.5;
  return `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
}

/** Horizontal partner link at the vertical midpoint of the two cards. */
export function partnerPath(a: Point, b: Point): string {
  const y = (a.y + b.y) / 2;
  const x1 = a.x;
  const x2 = b.x;
  return `M ${x1} ${y} L ${x2} ${y}`;
}

export function elbowPoint(from: Point, to: Point): Point {
  const midY = from.y + (to.y - from.y) * 0.5;
  return { x: to.x, y: midY };
}

const PET_HANDLE_HALF_W = 9;
const PET_HANDLE_DEPTH = 13;
const PET_COLLAR_R = 6;

export type PetLeashPaths = {
  /** Triangular handle loop below the owner (gutter). */
  handle: string;
  /** Solid curved lead. */
  drop: string;
  /** Circular collar loop on the pet. */
  collar: string;
};

/** Triangular handle loop — hangs below owner attach so it stays visible. */
function petLeashHandleTriangle(attach: Point): { path: string; apex: Point } {
  const cx = attach.x;
  const ay = attach.y;
  const w = PET_HANDLE_HALF_W;
  const apexY = ay + PET_HANDLE_DEPTH;
  const path = [
    `M ${cx} ${ay}`,
    `L ${cx - w} ${ay + PET_HANDLE_DEPTH * 0.45}`,
    `L ${cx} ${apexY}`,
    `L ${cx + w} ${ay + PET_HANDLE_DEPTH * 0.45}`,
    `Z`,
  ].join(" ");
  return { path, apex: { x: cx, y: apexY } };
}

/** Circle centered on the pet card top (collar). */
function petLeashCollarCircle(petTop: Point): { path: string; attach: Point } {
  const r = PET_COLLAR_R;
  const cy = petTop.y - r;
  const path = [
    `M ${petTop.x + r} ${cy}`,
    `A ${r} ${r} 0 1 1 ${petTop.x - r} ${cy}`,
    `A ${r} ${r} 0 1 1 ${petTop.x + r} ${cy}`,
  ].join(" ");
  return { path, attach: { x: petTop.x, y: cy - r } };
}

export function petLeashPaths(from: Point, to: Point): PetLeashPaths {
  const handle = petLeashHandleTriangle(from);
  const collar = petLeashCollarCircle(to);
  const fromPt = handle.apex;
  const toPt = collar.attach;

  const dy = toPt.y - fromPt.y;
  const sag = Math.max(10, dy * 0.2);
  const midX = (fromPt.x + toPt.x) / 2;
  const midY = (fromPt.y + toPt.y) / 2 + sag;
  const drop = `M ${fromPt.x} ${fromPt.y} Q ${midX} ${midY} ${toPt.x} ${toPt.y}`;

  return { handle: handle.path, drop, collar: collar.path };
}

/** Combined path for tests. */
export function petLeashPath(from: Point, to: Point): string {
  const { handle, drop, collar } = petLeashPaths(from, to);
  return `${handle} ${drop} ${collar}`;
}
