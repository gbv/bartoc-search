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
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { parseFacetFields } from "./utils/utils.js";
import { SearchFilter } from "./solr/search/SearchFilter.js";
import { runUpdateOnce } from "./utils/updateFromBartoc";
import fsPromises from "node:fs/promises";
import { parseRepeatableFilters } from "./utils/filters.ts";
import { buildLuceneWithTrigrams } from "./utils/helpers.ts";
import { getEditionPreviews } from "./solr/editionPreviews";
import { getParentTitles } from "./solr/parentTitles";

// Default for workers in the queue processing system with Redis:
//  - test → OFF
//  - local development → workers ON
//  - staging/production → ON,
const DEFAULT_WITH_WORKERS = config.env !== "test" && process.env.DISABLE_WORKERS !== "1";
config.log?.(`Background workers are ${DEFAULT_WITH_WORKERS ? "Enabled" : "Disabled"}`);

const base = process.env.VIRTUAL_PATH || "/";
const DATA_DIR = config.DATA_DIR;
const BARTOC_COMPONENTS_STYLE_PATH = path.resolve(
  "node_modules",
  "@gbv",
  "bartoc-components",
  "dist",
  "style.css",
);

// Cached production template
const templateHtml = config.env === "production"
  ? await fs.readFile("./dist/index.html", "utf-8")
  : "";

async function fileExists(p: string) { try { await fsPromises.access(p); return true; } catch { return false; } }

let updaterStarted = false;

async function ensureArtifactsAtBoot() {
  const currentDir = path.join(DATA_DIR, "artifacts", "current");
  const metaFile   = path.join(currentDir, "artifacts.meta.json");
  const haveArtifacts = await fileExists(metaFile);

  if (haveArtifacts) return;

  if (updaterStarted) return;
  updaterStarted = true;

  config.warn?.("No artifacts found — starting updater in background…");
  runUpdateOnce().catch((e) => config.warn?.("Updater failed:", e));
}

function makeMorganSkip({ base = "/" } = {}) {
  // normalize base
  const b = base.endsWith("/") ? base : `${base}/`;

  return (req: Request): boolean => {
    const url = req.originalUrl || "";

    // never log bull-board noise
    if (url.startsWith("/admin/queues")) return true;

    // keep API logs
    if (url.startsWith("/api/")) return false;

    // (optional) keep the HTML entry request (SSR page)
    if (url === b || url === base || url.startsWith(`${b}?`) || url.startsWith(`${base}?`)) {
      return false;
    }

    // hide Vite dev chatter & source modules
    if (url.startsWith("/@vite")) return true;
    if (url.startsWith("/src/")) return true;
    if (url.startsWith("/node_modules/")) return true;

    // hide typical static assets (Vite / public)
    if (url.startsWith("/assets/")) return true;
    if (url.startsWith("/data/")) return true;
    if (/\.(css|js|map|svg|png|jpg|jpeg|gif|ico|woff2?)($|\?)/.test(url)) return true;

    // default: hide
    return true;
  };
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
    withVite = config.env !== "production" && config.env !== "test",
    withWorkers = DEFAULT_WITH_WORKERS,
    withUpdater = config.env !== "test",
    withFrontend = config.env !== "test",
  } = opts ?? {};

  const app = express();
  app.disable("x-powered-by");
  // Logging only dedicated requests
  app.use(
    morgan("dev" as never, {
      skip:  makeMorganSkip({ base }),
    }),
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.get("/vendor/bartoc-components/style.css", (_req: Request, res: Response) => {
    res.type("text/css");
    res.sendFile(BARTOC_COMPONENTS_STYLE_PATH);
  });

  // Initialize WebSocket support, not in tests for simplicity
  if (config.env !== "test") {
    expressWs(app);
  }

  // ==========================
  // Add Vite or respective production middlewares
  // ==========================
  /** @type {import('vite').ViteDevServer | undefined} */
  let vite: ViteDevServer | undefined;
  if (withFrontend) {
    if (config.env !== "production" && withVite) {
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

      // Serve static a root path
      app.use(sirv("./dist", { extensions: [] }));

      // Serve static under base path
      app.use(base, sirv("./dist", { extensions: [] }));
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
      order = SortOrder.ASC,
      format = "",
      editions = "false",
    } = req.query as Partial<SearchParams>;
    const searchText = String(search ?? "");
    const searchField = String(field ?? "").trim() || "allfields";

    // Search publisher URIs exactly when Publisher is selected in the search field menu.
    const publisherUriSearch = searchField === "publisher_en" &&
      /^https?:\/\//i.test(searchText.trim());
    const baseLucene = publisherUriSearch
      ? new SearchFilter("publisher_uri_ss").equals(searchText.trim()).toHttpQueryStringParameter()
      : LuceneQuery.fromText(searchText, searchField, 3, 2).operator("AND").toString();

    // 2) Compose the base query with *trigram* fields (fuzzy char n-grams)
    const { q, defType } = buildLuceneWithTrigrams({
      userQuery: searchText,
      baseField: searchField,
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

      // Count matching editions with the same query and facet filters, regardless of the selected mode.
      const editionCountOp = new SolrClient().searchOperation
        .prepareSelect(config.solr.coreName)
        .for({ toString: () => q, getDefType: () => defType })
        .filter(new SearchFilter("version_of_s").raw("version_of_s:[* TO *]"))
        .limit(0);
      // Apply selected facets to both queries 
      // i.e. language:de must also limit the edition count.
      const addFacetFilter = (filter: SearchFilter) => {
        op.filter(filter);
        editionCountOp.filter(filter);
      };

      // Edition documents have version_of_s. Only keeps them, Exclude removes them,
      // and Include leaves this field unfiltered so both kinds can match.
      if (editions === "only") {
        op.filter(new SearchFilter("version_of_s").raw("version_of_s:[* TO *]"));
      } else if (editions !== "true") {
        op.filter(
          new SearchFilter("version_of_s")
            .raw("-version_of_s:[* TO *]")
        );
      }


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
        addFacetFilter(
          new SearchFilter(facetName)
            .raw(`-${facetName}:[* TO *]`)
        );
        continue;
      }

      facetValues = facetValues.filter(v => v !== NO_VALUE);

      if (facetValues.length == 1 && !facetValues.includes(NO_VALUE)) {
        addFacetFilter(
          new SearchFilter(facetName)
            .equals(facetValues[0])
        );
      } else {
        addFacetFilter(
          new SearchFilter(facetName).raw(`{!terms f=${facetName}}${facetValues.join(",")}`)
        );
      }
    }

    // Execute query
    const solrRes = await op.execute<SolrSearchResponse>();

    if (format === "jskos") {
      const records = solrRes.response.docs.map((doc) => JSON.parse(doc.fullrecord));
      res.json(records);
      return;
    }

    const rawFacetFields = solrRes.facet_counts?.facet_fields;
    const facets = parseFacetFields(rawFacetFields);

    // The count is optional: keep search results and omit the number if this query fails.
    let matchingEditionCount;
    try {
      const editionCountRes = await editionCountOp.execute<SolrSearchResponse>();
      matchingEditionCount = editionCountRes.response.numFound;
    } catch (error) {
      config.warn?.("Edition count lookup failed:", error);
    }

    // Edition previews are supplementary: search results remain available if this lookup fails.
    let editionsByMain;
    if (solrRes.response.docs.length > 0) {
      try {
        editionsByMain = await getEditionPreviews(solrRes.response.docs);
      } catch (error) {
        config.warn?.("Edition preview lookup failed:", error);
      }
    }

    res.json({
      response: solrRes.response,
      facets,
      matchingEditionCount,
      parentTitles: await getParentTitles(solrRes.response.docs),
      ...(editionsByMain === undefined ? {} : { editionsByMain }),
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

    const { getTerminologiesQueue } = await import("./queue/worker.js");

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
      if (config.env !== "production") {
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
        render = (await import("../../dist/server/entry-server.js")).render;
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

  // ====== Optional bootstrap ======
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
  withFrontend?: boolean;
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
