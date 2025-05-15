import express, { Request, Response } from "express";
import morgan from "morgan";
import path from "path";
import portfinder from "portfinder";
import config from "./conf/conf";
import { connection } from "mongoose";
import * as solr from "./solr/solr";
import { SolrClient } from "./solr/SolrClient";
import { SolrSearchResponse } from "./types/solr";
import { LuceneQuery } from "./solr/search/LuceneQuery";

const app = express();
app
  .disable("x-powered-by")
  .use(morgan("dev"))
  .use(express.urlencoded({ extended: true }))
  .use(express.json());

// ==========================
// Health check
// ==========================
app.get("/health", async (req: Request, res: Response) => {
  const solrHealthy = solr.isSolrReady();

  res.json({
    ok: true,
    mongoConnected: connection.readyState === 1,
    solrConnected: solrHealthy,
  });
});

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
};
