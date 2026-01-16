import fs from "node:fs/promises";
import path from "node:path";
import { ConceptDocument } from "../types/jskos";

export interface DdcLabelsMap {
  [code: string]: string
}

export async function loadDDCConcepts(filePath: string): Promise<ConceptDocument[]> {
  const text = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid registry index JSON");
  }
  return data as ConceptDocument[];
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
  
  const concepts = await loadDDCConcepts(snapshotPath);
  const map: DdcLabelsMap = {};
  
  concepts.forEach(concept => {
    const code = Array.isArray(concept.notation) ? concept.notation[0] : undefined;
    const labels = concept.prefLabel["en"];
    if (typeof code === "string" && labels && typeof labels === "string") {
      map[code] = labels;
    }
  });
  
  await fs.writeFile(tmpPath, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);

  return map;
}
