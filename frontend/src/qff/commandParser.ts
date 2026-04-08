/**
 * Mirrors backend/qff/command_parser.py for client-side gating only.
 * Keep behavior aligned with Python; tests cover parity with test_command_parser.py.
 */

export type QffParseResult = { kind: "unknown"; raw: string } | { kind: "known" };

const Direction = {
  N: "n",
  S: "s",
  E: "e",
  W: "w",
  NW: "nw",
  NE: "ne",
  SW: "sw",
  SE: "se",
  UP: "up",
  DOWN: "down",
  IN: "in",
  OUT: "out",
} as const;

function stripGoPrefix(s: string): string {
  const t = s.trim();
  if (t.toLowerCase().startsWith("go ")) {
    return t.slice(3).trim();
  }
  return t;
}

function normalize(line: string): string {
  let n = line.trim();
  if (n.startsWith("/")) {
    n = n.slice(1).trim();
  }
  n = stripGoPrefix(n);
  return n.trim();
}

const DIRECTION_SYNONYMS: [string, string][] = [
  ["northwest", Direction.NW],
  ["southwest", Direction.SW],
  ["northeast", Direction.NE],
  ["southeast", Direction.SE],
  ["north", Direction.N],
  ["south", Direction.S],
  ["east", Direction.E],
  ["west", Direction.W],
  ["down", Direction.DOWN],
  ["up", Direction.UP],
  ["enter", Direction.IN],
  ["leave", Direction.OUT],
  ["exit", Direction.OUT],
];

const SINGLE_LETTER: Record<string, string> = {
  n: Direction.N,
  s: Direction.S,
  e: Direction.E,
  w: Direction.W,
  u: Direction.UP,
  d: Direction.DOWN,
};

const TWO_LETTER: Record<string, string> = {
  nw: Direction.NW,
  ne: Direction.NE,
  sw: Direction.SW,
  se: Direction.SE,
};

export function parseQffCommandLine(line: string): QffParseResult {
  const raw = line;
  const n = normalize(line);
  if (!n) {
    return { kind: "unknown", raw };
  }

  const low = n.toLowerCase();

  if (low === "say") {
    return { kind: "known" };
  }
  if (low.startsWith("say ")) {
    return { kind: "known" };
  }

  if (low.startsWith("talk to ")) {
    return { kind: "known" };
  }
  if (low.startsWith("talk ")) {
    return { kind: "known" };
  }
  if (low === "talk") {
    return { kind: "known" };
  }
  if (low.startsWith("speak to ")) {
    return { kind: "known" };
  }
  if (low.startsWith("speak ")) {
    return { kind: "known" };
  }
  if (low.startsWith("greet ")) {
    return { kind: "known" };
  }

  if (low.startsWith("eat ")) {
    return { kind: "known" };
  }
  if (low === "eat") {
    return { kind: "known" };
  }
  if (low.startsWith("drink ")) {
    return { kind: "known" };
  }
  if (low === "drink") {
    return { kind: "known" };
  }

  if (low.startsWith("use ")) {
    return { kind: "known" };
  }
  if (low.startsWith("pull ")) {
    return { kind: "known" };
  }
  if (low.startsWith("push ")) {
    return { kind: "known" };
  }
  if (low.startsWith("open ")) {
    return { kind: "known" };
  }

  if (low.startsWith("look at ")) {
    return { kind: "known" };
  }
  if (low.startsWith("look ")) {
    return { kind: "known" };
  }
  if (low === "look") {
    return { kind: "known" };
  }
  if (low.startsWith("inspect ")) {
    return { kind: "known" };
  }
  if (low === "inspect") {
    return { kind: "known" };
  }

  if (low.startsWith("unequip ")) {
    return { kind: "known" };
  }
  if (low === "unequip") {
    return { kind: "known" };
  }

  if (low.startsWith("drop ")) {
    return { kind: "known" };
  }
  if (low === "drop") {
    return { kind: "known" };
  }
  if (low.startsWith("get ")) {
    return { kind: "known" };
  }
  if (low === "get") {
    return { kind: "known" };
  }
  if (low.startsWith("take ")) {
    return { kind: "known" };
  }
  if (low === "take") {
    return { kind: "known" };
  }
  if (low.startsWith("equip ")) {
    return { kind: "known" };
  }
  if (low === "equip") {
    return { kind: "known" };
  }

  if (low === "search" || low === "search room" || low === "scr") {
    return { kind: "known" };
  }
  if (/^search\s+room$/.test(low)) {
    return { kind: "known" };
  }

  for (const [word] of DIRECTION_SYNONYMS) {
    if (low === word || low === `go ${word}`) {
      return { kind: "known" };
    }
  }

  const parts = low.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const tok = parts[0]!;
    if (tok in SINGLE_LETTER) {
      return { kind: "known" };
    }
    if (tok in TWO_LETTER) {
      return { kind: "known" };
    }
    if (tok === "in") {
      return { kind: "known" };
    }
    if (tok === "out") {
      return { kind: "known" };
    }
  }

  if (parts.length === 2 && parts[0] === "go") {
    const rest = parts[1]!;
    if (rest in SINGLE_LETTER) {
      return { kind: "known" };
    }
    if (rest in TWO_LETTER) {
      return { kind: "known" };
    }
    for (const [word] of DIRECTION_SYNONYMS) {
      if (rest === word) {
        return { kind: "known" };
      }
    }
  }

  return { kind: "unknown", raw };
}
