/** Live EpS for HUD labels; updated from the game loop, not every React render. */

let displayEps = 0;
let displayEpsRevision = 0;
const listeners = new Set<() => void>();

function displayEpsKey(eps: number): number {
  if (eps < 100) return Math.round(eps * 10);
  return Math.round(eps);
}

export function subscribeDisplayEps(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getDisplayEpsSnapshot(): number {
  return displayEps;
}

/** Bump subscribers only when the displayed rate would change. */
export function publishDisplayEpsIfChanged(eps: number): void {
  const nextKey = displayEpsKey(eps);
  const prevKey = displayEpsKey(displayEps);
  if (nextKey === prevKey && displayEpsRevision > 0) return;
  displayEps = eps;
  displayEpsRevision += 1;
  for (const listener of listeners) {
    listener();
  }
}
