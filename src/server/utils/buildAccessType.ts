import fs from "node:fs/promises";
import path from "node:path";
import { ConceptDocument } from "../types/jskos";

export interface AccessTypesLabelsMap {
  [type: string]: string
}

export async function loadAccessTypesConcepts(filePath: string): Promise<ConceptDocument[]> {
  const text = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid registry index JSON");
  }
  return data as ConceptDocument[];
}

export async function buildAccessType(snapshotPath: string, outDir: string) {
  await fs.mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "access_type.json");
  const tmpPath = finalPath + ".tmp";


  const concepts = await loadAccessTypesConcepts(snapshotPath);
  const map: AccessTypesLabelsMap = {};

  concepts.forEach(concept => {
    map[concept.uri] = concept.notation[0];
  });


  await fs.writeFile(tmpPath, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);

  return map;
}
