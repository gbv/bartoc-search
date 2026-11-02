import fs from "node:fs/promises";
import path from "node:path";

/** Build a small URI-to-error-codes artifact from the quality report snapshot. */
export async function buildQualityErrorCodes(
  snapshotPath: string,
  outDir: string,
): Promise<Record<string, string[]>> {
  // The report groups findings by record URI in errors[].position.id.
  const report = JSON.parse(await fs.readFile(snapshotPath, "utf8")) as {
    errors?: Array<{ position?: { id?: string }; errors?: Array<{ type?: string[] }> }>;
  };
  if (!report || !Array.isArray(report.errors)) {
    throw new Error("Invalid quality report: missing errors array");
  }

  // One record can have several findings with the same code; keep each code once.
  const codesByUri = new Map<string, Set<string>>();
  for (const group of report.errors) {
    const uri = group.position?.id;
    if (!uri) continue;
    for (const finding of group.errors ?? []) {
      // The report uses the first type as the public error code.
      const code = finding.type?.[0];
      if (!code) continue;
      if (!codesByUri.has(uri)) codesByUri.set(uri, new Set());
      codesByUri.get(uri)!.add(code);
    }
  }

  const codes = Object.fromEntries(
    [...codesByUri].map(([uri, values]) => [uri, [...values]]),
  );
  await fs.mkdir(outDir, { recursive: true });
  const output = path.join(outDir, "quality-error-codes.json");
  // Rename the finished file so readers never see partially written JSON.
  await fs.writeFile(output + ".tmp", JSON.stringify(codes, null, 2), "utf8");
  await fs.rename(output + ".tmp", output);
  return codes;
}
