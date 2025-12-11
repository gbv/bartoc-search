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
import { runUpdateOnce } from "./utils/updateFromBartoc";
import fsPromises from "node:fs/promises";
import { parseRepeatableFilters } from "./utils/filters.ts";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
const base = process.env.VIRTUAL_PATH || "/";
const DATA_DIR = process.env.DATA_DIR ?? "data";

// Cached production template
const templateHtml = isProduction
  ? await fs.readFile("./dist/client/index.html", "utf-8")
  : "";

async function fileExists(p: string) { try { await fsPromises.access(p); return true; } catch { return false; } }
async function ensureArtifactsAtBoot() {
  const currentDir = path.join(DATA_DIR, "artifacts", "current");
  const metaFile   = path.join(currentDir, "artifacts.meta.json");
  const haveArtifacts = await fileExists(metaFile);

  if (haveArtifacts) return;

  const promise = runUpdateOnce();
  if (!haveArtifacts) {
    console.log("No artifacts found — running updater before starting server…");
    await promise;
    console.log("Artifacts ready.");
  } else {
    console.log("Kicking updater in background (artifacts already present).");
    promise.catch((e) => console.warn("Updater failed in background:", e));
  }
}

/**
 * Create and configure the app without starting it.
 * Flags:
 *  - withVite: enable Vite dev middlewares (only outside tests)
 *  - withWorkers: start listeners/background tasks (vocabulary changes, NKOS load, bull-board)
 *  - withUpdater: run ensureArtifactsAtBoot
 */
export async function createApp(opts?: {
  withVite?: boolean;
  withWorkers?: boolean;
  withUpdater?: boolean;
  withFrontend?: boolean;
}) {
  const {
    withVite = !isProduction && !isTest,
    withWorkers = !isTest,
    withUpdater = !isTest,
    withFrontend = !isTest,
  } = opts ?? {};

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

  // Initialize WebSocket support, not in tests for simplicity
  if (!isTest) {
    expressWs(app);
  }

  // ==========================
  // Add Vite or respective production middlewares
  // ==========================
  /** @type {import('vite').ViteDevServer | undefined} */
  let vite: ViteDevServer | undefined;
  if (withFrontend) {
    if (!isProduction && withVite) {
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
      order = SortOrder.ASC
    } = req.query as Partial<SearchParams>;

    // Building the query
    // 1) Build the *base* Lucene query from the user text.
    //    - `search`: raw user input (string)
    //    - `field`: which field to search in (e.g. "allfields", "title_search")
    //    - The numbers (3, 2) are weights/params used by your builder (e.g. phrase vs. terms).
    //    - keeping the operator as OR to allow partial matches across tokens.
    const base = LuceneQuery.fromText(search, field, 3, 2).operator("OR");

    // Convert to a final Lucene string for Solr.
    const baseLucene = base.toString();

    // 2) Compose the base query with *trigram* fields (fuzzy char n-grams)
    const { buildLuceneWithTrigrams } = await import("./utils/helpers.ts"); // adjust path
    const { q, defType } = buildLuceneWithTrigrams({
      userQuery: String(search ?? ""),
      baseField: String(field ?? "allfields"),
      baseLucene,
    });

    // Parse the *modern* repeatable ?filter=... parameters into
    // internal Solr facet fields → values.
    // Legacy parameters (?languages, ?subject, ?partOf, ?license, …)
    // are now normalized on the *client side* (SearchView.vue) and
    // converted to `filter=` before reaching this endpoint.
    const facetFilters: Record<string, string[]> =
      parseRepeatableFilters(req.query.filter as string | string[] | undefined);

    // Prepare the Solr query
    try {
      const solrQueryBuilder = new SolrClient()
        .searchOperation;

      const op = solrQueryBuilder
        .prepareSelect(config.solr.coreName)
        //.for(query) old way!
        .for({ toString: () => q, getDefType: () => defType })
        .sort(sort, order)
        .limit(limit)
        .facetMissing(true);


    // TODO(bartoc-search): consider VuFind-style facets using tag/exclude
    // Dynamically register each facet field

    // Always add ddc_root_ss to support DDC 1-digit facets
    facetFilters.ddc_root_ss = facetFilters.ddc_root_ss ?? [];

    for (const facetName of Object.keys(facetFilters)) {

      op.facetOnField(facetName);
      let facetValues = (facetFilters[facetName] ?? [])
        .map(v => v.trim())
        .filter(v => v !== "");

      // If nothing left and “no value” wasn’t requested, skip entirely
      if (facetValues.length === 0 && !facetFilters[facetName].includes(NO_VALUE)) {
        continue;
      }

      // If the user selected the “no value” bucket, add a missing‐field filter
      if (facetValues.includes(NO_VALUE)) {
        // -field:[* TO *] -> documents where the field does NOT exist
        op.filter(
          new SearchFilter(facetName)
            .raw(`-${facetName}:[* TO *]`)
        );
        continue;
      }

      facetValues = facetValues.filter(v => v !== NO_VALUE);

      if (facetValues.length == 1 && !facetValues.includes(NO_VALUE)) {
        op.filter(
          new SearchFilter(facetName)
            .equals(facetValues[0])
        );
      } else {
        op.filter(
          new SearchFilter(facetName).raw(`{!terms f=${facetName}}${facetValues.join(",")}`)
        );
      }
    }

    // Execute query
    //
    const solrRes = await op.execute<SolrSearchResponse>();
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

  app.get("/api/data", async (req: Request, res: Response): Promise<void> => {
    const { uri = "", format = "jskos" } = req.query as Partial<SearchParams>;

    if (!uri) {
      res.json([]);
      return;
    }
    if (format != "jskos" && format != "solr") {
      res.status(400).json({"message": "Expected response format jskos or solr"});
      return;
    }

    const query = new LuceneQuery()
      .term(uri)
      .in("id");

    try {
      const solrQueryBuilder = new SolrClient()
        .searchOperation;

      const results = await solrQueryBuilder
        .prepareSelect(config.solr.coreName)
        .for(query)
        .limit(1)
        .execute<SolrSearchResponse>();
      let doc = results.response.docs[0];
      if (doc) {
        if (format === "jskos") {
          doc = JSON.parse(doc.fullrecord);
        }
        res.json([doc]);
      } else {
        res.json([]);
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch Solr record" + (err instanceof Error ? `: ${err.message}` : "") });
    }
  });

  // ==========================
  // Build BullMQ UI board
  // ==========================
  if (withWorkers) {
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
  }

  // Serving data folder with artifacts
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

  // ====== bootstrap opzionali ======
  if (withUpdater) {
    await ensureArtifactsAtBoot();
  }
  if (withWorkers) {
    await loadNkosConcepts();
    await startVocChangesListener();
  }

  return app;

}

// ==========================
// Start server
// ==========================
export const startServer = async (opts?: {
  withVite?: boolean;
  withWorkers?: boolean;
  withUpdater?: boolean;
}) => {
  const app = await createApp(opts);
  if (config.env === "test") {
    portfinder.basePort = config.port;
    config.port = await portfinder.getPortPromise();
  }
  app.listen(config.port, () => {
    console.log(`Now listening on port ${config.port}`);
  });
  return app;
};


