// src/server/utils/runJskosEnrich.ts
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

/** Options for running jskos-enrich. */
export type EnrichOptions = {
  /** JSKOS set-type properties to enrich, e.g. ["subject","publisher","creator"]. */
  properties?: string[];
  /** Path to a schemes configuration file, e.g. "config/enrich.schemes.json". */
  schemesFile?: string;
  /** Quiet mode (suppresses warnings). Default: true. */
  quiet?: boolean;
};

/**
 * Run the `jskos-enrich` CLI on an NDJSON input and write an enriched NDJSON output.
 * Returns the output path, its SHA-256, and a naive line count.
 */
export async function runJskosEnrich(
  inputNdjson: string,
  outDir: string,
  outFileName = "vocs.enriched.ndjson",
  opts: EnrichOptions = {},
): Promise<{ outfile: string; sha256: string; count: number }> {
  await fs.mkdir(outDir, { recursive: true });
  const outfile = path.join(outDir, outFileName);

  // Build CLI args: jskos-enrich <input> <output> [--properties ...] [--schemes ...] [-q]
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

  // Always use the local binary from node_modules
  const bin = path.join("node_modules", ".bin", "jskos-enrich");
  try {
    await fs.access(bin);
  } catch {
    throw new Error(
      `Local jskos-enrich not found at ${bin}. Install it as a dependency (e.g., "npm i -D jskos-cli").`,
    );
  }

  // Run the process; inherit stdio so output appears in the parent process logs.
  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`jskos-enrich exit ${code}`)),
    );
  });

  // Compute SHA-256 and simple line count for the output file.
  const buf = await fs.readFile(outfile);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const count = (buf.toString("utf8").match(/\n/g) || []).length;

  return { outfile, sha256, count };
}
