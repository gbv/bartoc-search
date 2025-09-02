import fs from "node:fs/promises";
import path from "node:path";
import { ConceptDocument } from "../types/jskos";


export interface ApiTypeLabelsMap {
  [type: string]: string
}

export async function loadApiTypesConcepts(filePath: string): Promise<ConceptDocument[]> {
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
export async function buildBartocApiLabels(
  snapshotPath: string, outDir: string
): Promise<ApiTypeLabelsMap> {
  await fs.mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "bartoc-api-types-labels.json");
  const tmpPath = finalPath + ".tmp";
  
  const concepts = await loadApiTypesConcepts(snapshotPath);
  const map: ApiTypeLabelsMap = {};

  concepts.forEach(concept => {
    map[concept.uri] = concept.prefLabel.en;
  });

  await fs.writeFile(tmpPath, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);

  return map;
}


