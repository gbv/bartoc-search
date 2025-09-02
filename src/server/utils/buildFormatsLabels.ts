// src/server/utils/buildListedIn.ts
import fs from "node:fs/promises";
import path from "node:path";
import { ConceptDocument } from "../types/jskos";
import { FORMAT_URI_TO_GROUP } from "./formatUriToGroups";


export interface FormatGroup {
  /** Stable machine key (e.g., "skos", "rdf", "pdf") */
  key: string;
  /** Human-readable label (e.g., "SKOS") */
  label: string;
  /** One or more format URIs */
  uris: string[];
}

export async function loadFormatConcepts(filePath: string): Promise<ConceptDocument[]> {
  const text = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid registry index JSON");
  }
  return data as ConceptDocument[];
}

export async function buildFormatsLabels(
  snapshotPath: string,
  outDir: string
): Promise<number> {
  // ensure paths
  await fs.mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "format-groups.json");
  const tmpPath = finalPath + ".tmp";

  const concepts = await loadFormatConcepts(snapshotPath);

  // groupName -> Set<uri>
  const grouped = new Map<string, Set<string>>();
  for (const [uri, notationGroup] of Object.entries(FORMAT_URI_TO_GROUP as Record<string, string>)) {
    let set = grouped.get(notationGroup);
    if (!set) grouped.set(notationGroup, (set = new Set<string>()));
    set.add(uri);
  }


  const out: FormatGroup[] = Array.from(grouped.entries()).map(([notationGroup, set]) => {
    const concept = concepts.find(
      c => Array.isArray(c?.notation) && c.notation.includes(notationGroup)
    );
    const label = concept?.prefLabel?.en ?? notationGroup;

    return {
      key: notationGroup,          
      label,                       
      uris: Array.from(set)
    };
  });
        
  // atomic write
  await fs.writeFile(tmpPath, JSON.stringify(out, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);

  return Object.keys(out).length;
}

