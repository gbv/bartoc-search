import express, { Request, Response } from "express";
import morgan from "morgan";
import portfinder from "portfinder";
import config from "./conf/conf";
import { SolrClient } from "./solr/SolrClient";
import { SolrSearchResponse } from "./types/solr";
import { LuceneQuery } from "./solr/search/LuceneQuery";
import type { ViteDevServer } from "vite";
import fs from "node:fs/promises";
import { getStatus } from "./routes/status.js";
import { startVocChangesListener } from "./composables/useVocChanges";
import expressWs from "express-ws";
import { loadNkosConcepts } from "./utils/nskosService";
import { terminologiesQueue } from "./queue/worker.js";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

const isProduction = process.env.NODE_ENV === "production";
const base = process.env.VIRTUAL_PATH || "/";

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile("./dist/client/index.html", "utf-8")
  : "";

const app = express();

app.disable("x-powered-by");

// only log requests _not_ under /admin/queues
app.use(
  morgan("dev", {
    skip: (req) => req.originalUrl.startsWith("/admin/queues"),
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize WebSocket support
expressWs(app);

// ==========================
// Add Vite or respective production middlewares
// ==========================
/** @type {import('vite').ViteDevServer | undefined} */
let vite: ViteDevServer | undefined;
if (!isProduction) {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  });
  app.use(vite.middlewares);
} else {
  const compression = (await import("compression")).default;
  const sirv = (await import("sirv")).default;
  app.use(compression());
  app.use(base, sirv("./dist/client", { extensions: [] }));
}

// ==========================
// Health check
// ==========================
app.get("/status", getStatus);

// ==========================
// Search endpoint
// ==========================
app.get("/search", async (req: Request, res: Response): Promise<void> => {
  // Read params
  const rawQ = (req.query.q as string) || "";
  const field = (req.query.field as string) || "allfields";
  const rows = parseInt((req.query.rows as string) || "10");

  // Building the query
  const query = LuceneQuery.fromText(rawQ, field, 3, 2).operator("OR");

  try {
    const solrQueryBuilder = new SolrClient(config.solr.version)
      .searchOperation;

    const results = await solrQueryBuilder
      .prepareSelect("bartoc")
      .for(query)
      .limit(rows)
      .execute<SolrSearchResponse>();
    res.json(results);
  } catch (error) {
    console.error("Solr query failed:", error);
    res.status(500).json({
      error: "Solr query failed",
      details: (error as Error).message || "Unknown error",
    });
  }
});

// ==========================
// Generic API endpoint
// ==========================

// Express route
app.get("/api/solr", async (req: Request, res: Response): Promise<void> => {
  const id = req.query.id as string;

  const query = new LuceneQuery()
    .term(id)
    .in("id") // <— field name
    .operator("AND");

  try {
    const solrQueryBuilder = new SolrClient(config.solr.version)
      .searchOperation;

    const results = await solrQueryBuilder
      .prepareSelect("bartoc")
      .for(query)
      .limit(1)
      .execute<SolrSearchResponse>();
    res.json(results.response.docs[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Solr record" });
  }
});

// ==========================
// Build BullMQ UI board
// ==========================
// 1) Create the Express adapter and mount path
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

// 2) Create Bull-Board, passing in your BullMQ queues
createBullBoard({
  queues: [
    new BullMQAdapter(terminologiesQueue),
    // add more queues here...
  ],
  serverAdapter,
});

// 3) Mount the router
app.use("/admin/queues", serverAdapter.getRouter());

// ==========================
// Serve HTML
// ==========================
app.use("*all", async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, "");

    /** @type {string} */
    let template;
    /** @type {import('../client/entry-server.ts').render} */
    let render;
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile("./index.html", "utf-8");
      if (!vite) {
        throw new Error("Vite dev server not initialized");
      }
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/client/entry-server.ts")).render;
    } else {
      template = templateHtml;
      //@ts-expect-error TO DO
      render = (await import("./dist/server/entry-server.js")).render;
    }

    const { stream } = render(url);

    const [htmlStart, htmlEnd] = template.split("<!--app-html-->");

    res.status(200).set({ "Content-Type": "text/html" });

    res.write(htmlStart);
    for await (const chunk of stream) {
      if (res.closed) break;
      res.write(chunk);
    }
    res.write(htmlEnd);
    res.end();
  } catch (e) {
    if (e instanceof Error) {
      vite?.ssrFixStacktrace(e);
      console.log(e.stack);
      res.status(500).end(e.stack);
    } else {
      res.status(500).end("Unknown error");
    }
  }
});

// ==========================
// Start server
// ==========================
export const startServer = async () => {
  if (config.env == "test") {
    portfinder.basePort = config.port;
    config.port = await portfinder.getPortPromise();
  }
  app.listen(config.port, () => {
    console.log(`Now listening on port ${config.port}`);
  });

  await loadNkosConcepts();

  await startVocChangesListener();
};
