import { Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as solr from "../solr/solr";
import {
  SolrSearchResponse,
  SolrStatusResult,
  SolrResponse,
} from "../types/solr";
import { StatusResponse } from "../types/status";
import config from "../conf/conf";
import { isWebsocketConnected } from "../composables/useVocChanges.js";
import packageInfo from "../../../package.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAST_INDEX_FILE = join(__dirname, "../../../data/lastIndexedAt.txt");

export const getStatus = async (
  _req: Request,
  res: Response<StatusResponse>,
) => {
  // services checks

  //solr Status
  const solrStatus = await solr.solrStatus();
  const solrStatusResult: SolrStatusResult = mapSolrToStatus(solrStatus);

  // jskos status
  const jskosStatus = await isWebsocketConnected();

  // app title
  const title = config.title
    ? `${config.title}${config.env === "development" ? " (dev)" : ""}`
    : "BARTOC Search";

  const statusResponse: StatusResponse = {
    ok: true,
    config: {
      env: config.env,
      serverVersion: packageInfo.version,
      title,
    },
    solr: solrStatusResult,
    jskosServer: {
      connected: jskosStatus,
    },
  };

  res.json(statusResponse);
};

export function mapSolrToStatus(status: SolrResponse): SolrStatusResult {
  if ("error" in status) {
    return {
      connected: false,
      indexedRecords: 0,
      lastIndexedAt: "",
    };
  }

  const currentStatus = status as SolrSearchResponse;
  const numFound = currentStatus.response?.numFound ?? 0;

  const solrStatusResult: SolrStatusResult = {
    connected: true,
    indexedRecords: numFound,
    lastIndexedAt: getLastIndexedAt(),
  };

  return solrStatusResult;
}

/**
 * Returns the ISO timestamp of the last full‐index run,
 * or null if never written.
 */
export function getLastIndexedAt(): string | number | undefined {
  if (!existsSync(LAST_INDEX_FILE)) {
    return "";
  }
  return readFileSync(LAST_INDEX_FILE, "utf-8").trim();
}
