import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import * as readline from "node:readline";
import path from "node:path";
import { ConceptSchemeDocument } from "../types/jskos";

export async function buildAccessType(snapshotPath: string, outDir: string) {
  await fs.mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "access_type.json");
  const tmpPath = finalPath + ".tmp";

  const used = new Set<string>();
  const labels = new Map<string, string>();

  // 1) create stream with encoding + error handlers
  const rs = createReadStream(snapshotPath, { encoding: "utf8" });
  rs.on("error", (e) => console.error("read error:", e));

  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  rl.on("error", (e) => console.error("readline error:", e));

  for await (const line of rl) {
   
    if (!line) continue;
    let obj: ConceptSchemeDocument;
    try { obj = JSON.parse(line); } catch { continue; }

    const acc = obj?.ACCESS;
    if (acc) {
      const arr = Array.isArray(acc) ? acc : [acc];
      for (const u of arr) if (typeof u === "object") used.add(u.uri);
    }
  }
  rl.close();

  // 2) compose + atomic write
  const DEFAULT: Record<string, string> = {
    "http://bartoc.org/en/Access/Free": "Freely available",
    "http://bartoc.org/en/Access/Registered": "Registration required",
    "http://bartoc.org/en/Access/Licensed": "License required",
  };

  const out: Record<string, string> = {};
  for (const u of used) out[u] = labels.get(u) ?? DEFAULT[u] ?? u;

  await fs.writeFile(tmpPath, JSON.stringify(out, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);
}
