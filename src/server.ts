import express, { Request, Response } from "express";
import morgan from "morgan";
import cors from "cors";
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
  .use(express.json())
  .use(
    cors({
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    }),
  );

app.get("/health", async (req: Request, res: Response) => {
  const solrHealthy = solr.isSolrReady();

  res.json({
    ok: true,
    mongoConnected: connection.readyState === 1,
    solrConnected: solrHealthy,
  });
});

app.get("/search", async (req: Request, res: Response): Promise<void> => {
  const query = (req.query.q as string) || "*:*";
  const rows = parseInt((req.query.rows as string) || "10");

  // Building the query
  const solrQueryBuilder = new SolrClient(config.solr.version).searchOperation;
  console.log(`query => ${query}`);
  try {
    const results = await solrQueryBuilder
      .prepareSelect("bartoc")
      .for(new LuceneQuery().term(query))
      .limit(rows)
      .execute<SolrSearchResponse>();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Solr query failed" });
  }
});

export const startServer = async () => {
  if (config.env == "test") {
    portfinder.basePort = config.port;
    config.port = await portfinder.getPortPromise();
  }
  app.listen(config.port, () => {
    console.log(`Now listening on port ${config.port}`);
  });
};
