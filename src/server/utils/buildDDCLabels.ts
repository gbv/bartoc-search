import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import * as readline from "node:readline";
import path from "node:path";
import { ConceptSchemeDocument } from "../types/jskos";

export interface DdcLabelsMap {
  [code: string]: string
}

/**
 * Load (and cache) DDC labels from an NDJSON dump.
 * @param ndjsonPath - Path to NDJSON file.
 */
export async function buildDDCLabels(
  snapshotPath: string, outDir: string
): Promise<DdcLabelsMap> {
  await fs.mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "ddc-labels.json");
  const tmpPath = finalPath + ".tmp";
  
  // 1) create stream with encoding + error handlers
  const rs = createReadStream(snapshotPath, { encoding: "utf8" });
  rs.on("error", (e) => console.error("read error:", e));
  
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  rl.on("error", (e) => console.error("readline error:", e));


  const map: DdcLabelsMap = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const jskosRecord: ConceptSchemeDocument = JSON.parse(line);
      // pick the primary notation code
      const code = Array.isArray(jskosRecord.notation) ? jskosRecord.notation[0] : undefined;
      const labels = jskosRecord.prefLabel["en"];
      if (typeof code === "string" && labels && typeof labels === "string") {
        map[code] = labels;
      }
    } catch (e) {
      console.log(e);
    }
  }
  rl.close();

  await fs.writeFile(tmpPath, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);

  return map;
}


