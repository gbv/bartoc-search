import express, { Request, Response } from "express";
import morgan from "morgan";
import portfinder from "portfinder";
import config from "./conf/conf";
import { NO_VALUE } from "./conf/conf";
import { SolrClient } from "./solr/SolrClient";
import { SolrSearchResponse,  SortField, SortOrder, SearchParams } from "./types/solr";
import { LuceneQuery } from "./solr/search/LuceneQuery";
import type { ViteDevServer } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import { getStatus } from "./routes/status.js";
import { startVocChangesListener } from "./composables/useVocChanges";
import expressWs from "express-ws";
import { loadNkosConcepts } from "./utils/nskosService";
import { getTerminologiesQueue } from "./queue/worker.js";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { parseFacetFields } from "./utils/utils.js";
import { SearchFilter } from "./solr/search/SearchFilter.js";
import _ from "lodash";

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
app.get("/api/status", getStatus);

// ==========================
// Search endpoint
// ==========================
app.get("/api/search", async (req: Request, res: Response): Promise<void> => {
  const { search = "", 
    field = "allfields", 
    limit = 10, 
    sort = SortField.RELEVANCE, 
    order = SortOrder.ASC , 
    filters = "{}",
    format = "",
    uri = ""
  } = req.query as SearchParams;

  // Building the query
  const query = LuceneQuery.fromText(search, field, 3, 2).operator("OR");

  // Parse the filters field into an object
  let parsedFilters: Record<string,string[]> = {};
  try {
    parsedFilters = JSON.parse(filters);
    // e.g. parsed filters object: { languages_ss: ["en"] }
  } catch (e) {
    // TODO return a proper error here
    config.error?.("Failed to parse filters JSON:", filters, "with error " + e);
  }

  try {
    const solrQueryBuilder = new SolrClient()
      .searchOperation;

    const op = await solrQueryBuilder
      .prepareSelect(config.solr.coreName)
      .for(query)
      .sort(sort, order)
      .limit(limit)
      .facetMissing(true);

    // If we're only returning JSKOS, ask Solr to only fetch the `fullrecord` field
    if (format === "jskos") {
      op.field("fullrecord");
    }
   
    
    // Dynamically register each facet field
    Object.keys(parsedFilters).forEach((facetName) => {

      op.facetOnField(facetName);
      let facetValues = (parsedFilters[facetName] ?? [])
        .map(v => v.trim())
        .filter(v => v !== "");

      // If nothing left and “no value” wasn’t requested, skip entirely
      if (facetValues.length === 0 && !parsedFilters[facetName].includes(NO_VALUE)) {
        return;
      }

      // If the user selected the “no value” bucket, add a missing‐field filter
      if (facetValues.includes(NO_VALUE)) {
        // -field:[* TO *] -> documents where the field does NOT exist
        op.filter(
          new SearchFilter(facetName)
            .raw(`-${facetName}:[* TO *]`)
        );
      }

      facetValues = facetValues.filter(v => v !== NO_VALUE);

      if (facetValues.length == 1) {
        op.filter(
          new SearchFilter(facetName)
            .equals(facetValues[0])    
        );
      } else {
        op.filter(
          new SearchFilter(facetName)
            .ors(facetValues) 
        );
      }
    });

    // Execute query
    //
    const solrRes = await op.execute<SolrSearchResponse>();

    // JSKOS output requested
    if (format === "jskos") {
      const jskosRecords = (solrRes.response.docs || []).map((doc) => {
        try {
          return JSON.parse(doc.fullrecord);
        } catch {
          return doc.fullrecord; // in case it wasn't valid JSON
        }
      });

      if (!_.isEmpty(uri)) {
        const jskosRecord = jskosRecords.filter(j => j.uri === uri);
         res.json({
          ...jskosRecord,
        });
        return;
      }

      res.json({
        ...jskosRecords,
      });
      return;
    }

    // If we reach here, we are returning Solr's raw response
    const rawFacetFields = solrRes.facet_counts?.facet_fields;
    const facets = parseFacetFields(rawFacetFields);

    // Serialize answer for the client
    res.json({
      response: solrRes.response,
      facets
    });

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
    const solrQueryBuilder = new SolrClient()
      .searchOperation;

    const results = await solrQueryBuilder
      .prepareSelect(config.solr.coreName)
      .for(query)
      .limit(1)
      .execute<SolrSearchResponse>();
    res.json(results.response.docs[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Solr record" + (err instanceof Error ? `: ${err.message}` : "") });
  }
});

// ==========================
// Build BullMQ UI board
// ==========================
// 1) Create the Express adapter and mount path
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

// 2) Create Bull-Board, passing in your BullMQ queues
getTerminologiesQueue().then((terminologiesQueue) => {
  if (terminologiesQueue) {
    createBullBoard({
      queues: [
        new BullMQAdapter(terminologiesQueue),
        // add more queues here...
      ],
      serverAdapter,
    });
  } else {
    console.warn("BullMQ Board not started: terminologiesQueue unavailable");
  }
});

// 3) Mount the router
app.use("/admin/queues", serverAdapter.getRouter());

// Serving data folder with artifacts
const DATA_DIR = process.env.DATA_DIR ?? "data";
app.use("/data", express.static(path.join(DATA_DIR, "artifacts", "current")));

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
      render = (await vite.ssrLoadModule("/src/client/entry-server.js")).render;
    } else {
      template = templateHtml;
      //@ts-expect-error TO DO
      render = (await import("./dist/server/entry-server.js")).render;
    }

    const { stream } = await render(url);

    const [htmlStart, htmlEnd] = template.split("<!--app-html-->");

    res.status(200).set({ "Content-Type": "text/html" });

    res.write(htmlStart);
    for await (const chunk of stream) {
      if (res.closed) {
        break;
      }
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
