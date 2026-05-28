/** Lets AppLayout hide breadcrumbs while Squalls is in-game (lobby keeps them). */

type Listener = () => void;

let inGame = false;
const listeners = new Set<Listener>();

export function setSquallsInGame(next: boolean) {
  if (inGame === next) return;
  inGame = next;
  listeners.forEach((l) => l());
}

export function getSquallsInGame() {
  return inGame;
}

export function subscribeSquallsInGame(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
