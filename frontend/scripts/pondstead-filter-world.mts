/** stdin JSON { world: PondsteadServerWorldSnapshot, viewerSeat: number } — stdout filtered world */
import type { PondsteadServerWorldSnapshot } from "../src/pondstead/pondsteadServerSync";
import { filterWorldSnapshotForViewer } from "../src/pondstead/pondsteadFilterViewerWorld";

async function main() {
  const chunks: Buffer[] = [];
  for await (const ch of process.stdin) {
    chunks.push(ch as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  const body = JSON.parse(text) as { world: PondsteadServerWorldSnapshot; viewerSeat: number };
  const out = filterWorldSnapshotForViewer(body.world, Number(body.viewerSeat));
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
