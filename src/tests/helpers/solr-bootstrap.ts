import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import path from "node:path";
import fs from "node:fs";

let solr: StartedTestContainer | undefined;
const CORE = "terminologies";
const hostConfigsetDir = "docker/solr-config/terminologies-configset"
const abs = path.resolve(hostConfigsetDir);
const TARGET = "/configsets/terminologies-configset"; // inside container

export async function startSolrWithConfigset() {
  solr = await new GenericContainer("solr:8")
    .withExposedPorts(8983)
    .withWaitStrategy(Wait.forLogMessage("Server Started"))
    .withCopyDirectoriesToContainer([{ source: abs, target: TARGET }])
    .start();

  const port = solr.getMappedPort(8983);

  // Tell the app to use this Solr instance
  process.env.SOLR_HOST = "127.0.0.1";
  process.env.SOLR_PORT = String(port);

   // 1) Wait for Solr to accept HTTP first
  await waitHttp(`http://127.0.0.1:${port}/solr/admin/info/system`, 60_000);

  // 2) (Optional) sanity check: ensure files exist inside the container
  const checkFiles = await solr.exec(["bash", "-lc", `ls -la ${TARGET}/conf && test -f ${TARGET}/conf/solrconfig.xml`]);
  if (checkFiles.exitCode !== 0) {
    const logs = await solr.logs();
    throw new Error(`solr create failed (exit ${checkFiles.exitCode}):\n${checkFiles.output}\n--- logs ---\n${logs}`);
  }

  // 3) Create the core using the **container** path (TARGET), NOT the host path
  const create = await solr.exec(["bash", "-lc", `solr create -c ${CORE} -d ${TARGET}`]);
  if (create.exitCode !== 0) {
    const logs = await solr.logs();
    throw new Error(`solr create failed (exit ${create.exitCode}):\n${create.output}\n--- logs ---\n${logs}`);
  }

  // 4) Wait until the core responds
  await waitHttp(`http://127.0.0.1:${port}/solr/${CORE}/admin/ping`, 90_000);

  return { port, core: CORE };
}

/**
 * Seed Solr with an in-memory array of docs.
 */
export async function seedSolr(docs: unknown[], { batchSize = 200 } = {}) {
  const port = Number(process.env.SOLR_PORT);
  const core = "terminologies";
  const url  = `http://127.0.0.1:${port}/solr/${core}/update?commit=true`;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Seed failed [${i}-${i + chunk.length}]: ${r.status} ${text}`);
    }
  }
}

/**
 * Seed Solr from a JSON file that contains a JSON array of solr docs.
 */
export async function seedSolrFromJson(fileRelPath: string, opts?: { batchSize?: number }) {
  const file = path.resolve(fileRelPath);
  if (!fs.existsSync(file)) throw new Error(`Fixture not found: ${file}`);

  const raw = fs.readFileSync(file, "utf8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) {
    throw new Error(`JSON fixture must be an array: ${file}`);
  }
  await seedSolr(arr, opts);
  return arr;
}

export async function stopSolr() {
  if (solr) await solr.stop();
}

async function waitHttp(url: string, timeoutMs: number) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  if (solr) {
    const logs = await solr.logs();
    console.error(`Timeout waiting for ${url}\n--- container logs ---\n${logs}`);
  }
  throw new Error(`Timeout waiting for ${url}`);
}
