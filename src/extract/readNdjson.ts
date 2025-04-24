import * as fs from "fs";
import * as readline from "readline";
import { JskosConceptSchemeDocument } from "../types/jskos";

export async function readNdjson(
  path: string,
): Promise<JskosConceptSchemeDocument[]> {
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const documents: JskosConceptSchemeDocument[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      documents.push(JSON.parse(line));
    } catch (err) {
      console.warn(err, line);
    }
  }

  return documents;
}
