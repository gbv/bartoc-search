// One-shot, CLI indexer.
// - Waits until Solr is reachable (ping).
// - Runs existing bootstrapIndexSolr() (streams NDJSON → Solr).
// - Uses a simple filesystem lock so two indexers never run at once.

import fs from "node:fs/promises";
import { constants as FS } from "node:fs";
import path from "node:path";
import { SolrClient } from "./SolrClient";
import config from "../conf/conf";
import { bootstrapIndexSolr } from "./solr";
import { PingResponse } from "../types/solr";


// Where data lives.
const CURRENT_DIR = path.join(config.ARTIFACTS, "current");
const LOCK_PATH = path.join(config.ARTIFACTS, ".index.lock");

/** Sleep helper */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ensure Solr is reachable by pinging the target core a few times.
 * This mirrors connectToSolr() retry behavior, but stays local to the CLI.
 */
async function ensureSolrUp(retries = 10, delayMs = 2000) {
  const client = new SolrClient();
  for (let i = 1; i <= retries; i++) {
    try {
      const resp = await client.collectionOperation
        .preparePing(config.solr.coreName)
        .execute<PingResponse>();
      
      if (resp) {
        config.log?.(`Solr is up (attempt ${i}/${retries})`);
        break;
      }
      
      return;
    } catch (e) {
      if (i === retries) throw e;
      config.warn?.(`Solr not ready (attempt ${i}/${retries}), retrying in ${delayMs}ms…`);
      await wait(delayMs);
    }
  }
}

/**
 * Simple cross-process mutex using a lock file.
 * - Creates the file with O_EXCL so creation fails if it already exists.
 * - Writes PID + timestamp inside for diagnostics.
 * - Removes the file in a finally{} block so the lock is released on success/failure.
 */
async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  // Make sure artifacts dir exists (in case this is the first run)
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  // Try to create the lock atomically; fail if it already exists
  const handle = await fs.open(lockPath, "wx").catch(() => null);
  if (!handle) {
    throw new Error(
      `Another indexing process seems to be running (lock exists: ${lockPath}).`
    );
  }

  // Write some context in the lock file (helpful when debugging)
  const payload = `${process.pid} ${new Date().toISOString()}\n`;
  await handle.writeFile(payload);
  await handle.close();

  try {
    return await fn();
  } finally {
    // Always release the lock, even if indexing throws
    await fs.rm(lockPath, { force: true }).catch(() => {});
  }
}

async function main() {
  // Optional: ensure the published artifacts dir exists & is readable
  await fs.access(CURRENT_DIR, FS.R_OK).catch(async () => {
    // If there’s no current publish yet, bootstrapIndexSolr() will still fall back to remote.
    await fs.mkdir(CURRENT_DIR, { recursive: true });
  });

  await withLock(LOCK_PATH, async () => {
    await ensureSolrUp();
    await bootstrapIndexSolr(); // Uses ensureSnapshotForIndexing() → enriched or raw vocs
  });

  console.log("Index-once script completed.");
}

main().catch((err) => {
  console.error("Index-once script failed:", err?.message || err);
  process.exit(1);
});
