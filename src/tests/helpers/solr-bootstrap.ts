import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

let solr: StartedTestContainer | undefined;

export async function startSolr() {
  solr = await new GenericContainer("solr:9")
    .withExposedPorts(8983)
    .withWaitStrategy(Wait.forLogMessage("Server Started"))
    .start();

  const port = solr.getMappedPort(8983);

  // Tell the app to use this Solr instance
  process.env.SOLR_HOST = "127.0.0.1";
  process.env.SOLR_PORT = String(port);

  // Match config.default.json coreName
  const CORE = "terminologies";
  await solr.exec(["bash", "-lc", `solr create -c ${CORE}`]);

  // Wait until core is ready
  await ping(`http://127.0.0.1:${port}/solr/${CORE}/admin/ping`, 90_000);

  return { port, core: CORE };
}

export async function seedSolr(docs: unknown[]) {
  const port = Number(process.env.SOLR_PORT);
  const url = `http://127.0.0.1:${port}/solr/terminologies/update?commit=true`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(docs),
  });
  if (!r.ok) throw new Error(`Seed failed: ${r.status} ${await r.text()}`);
}

export async function stopSolr() {
  if (solr) await solr.stop();
}

async function ping(url: string, timeoutMs: number) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Solr did not become ready");
}
