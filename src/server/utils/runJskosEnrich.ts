// src/server/utils/runJskosEnrich.ts
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export type EnrichOptions = {
  properties?: string[];
  schemesFile?: string;
  quiet?: boolean;
};

export async function runJskosEnrich(
  inputNdjson: string,
  outDir: string,
  outFileName = "vocs.enriched.ndjson",
  opts: EnrichOptions = {},
): Promise<{ outfile: string; sha256: string; count: number }> {
  await fs.mkdir(outDir, { recursive: true });
  const outfile = path.join(outDir, outFileName);

  const args = [inputNdjson, outfile];

  if (opts.properties?.length) {
    args.push("--properties", opts.properties.join(","));
  }

  if (opts.schemesFile) {
    const schemesAbs = path.isAbsolute(opts.schemesFile)
      ? opts.schemesFile
      : path.resolve(process.cwd(), opts.schemesFile);
    try {
      await fs.access(schemesAbs);
    } catch {
      throw new Error(`Schemes file not found: ${schemesAbs}`);
    }
    args.push("--schemes", schemesAbs);
  }

  if (opts.quiet !== false) {
    args.push("-q");
  }

  const script = path.resolve("node_modules/jskos-cli/bin/jskos-enrich");
  try {
    await fs.access(script);
  } catch {
    throw new Error(
      `jskos-cli script not found at ${script}. Install it (e.g. "npm i -D jskos-cli").`,
    );
  }

  await new Promise<void>((resolve, reject) => {
    const p = spawn(process.execPath, [script, ...args], { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`jskos-enrich exit ${code}`)),
    );
  });

  const buf = await fs.readFile(outfile);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const count = (buf.toString("utf8").match(/\n/g) || []).length;

  return { outfile, sha256, count };
}
