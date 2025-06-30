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
import { StatusResponse, StatusRuntimeInfo } from "../types/status";
import { formatBytes, formatTimestamp } from "../utils/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LAST_INDEX_FILE = join(__dirname, "../../../data/lastIndexedAt.txt");

// read version dal package.json
const { version: appVersion } = JSON.parse(
  readFileSync(join(__dirname, "../../../package.json"), "utf-8"),
);

export const getStatus = async (
  req: Request,
  res: Response<StatusResponse>,
) => {
  // Runtime infos
  const runtimeInfo: StatusRuntimeInfo = getRuntimeInfo();

  // services checks

  //solr
  const solrStatus = await solr.solrStatus();
  const solrStatusResult: SolrStatusResult = mapSolrToStatus(solrStatus);

  const statusResponse: StatusResponse = {
    ok: true,
    appVersion,
    environment: process.env.NODE_ENV ?? "development",
    runtimeInfo,
    services: {
      solr: solrStatusResult,
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
      firstUpdate: null,
      lastUpdate: null,
    };
  }

  const currentStatus = status as SolrSearchResponse;
  const numFound = currentStatus.response?.numFound ?? 0;
  const fields = currentStatus.stats?.stats_fields?.modified_dt ?? {};

  const solrStatusResult: SolrStatusResult = {
    connected: numFound > 0,
    indexedRecords: numFound,
    lastIndexedAt: formatTimestamp(getLastIndexedAt()),
    firstUpdate: formatTimestamp(fields.min) ?? null,
    lastUpdate: formatTimestamp(fields.max) ?? null,
  };

  return solrStatusResult;
}

function getRuntimeInfo(): StatusRuntimeInfo {
  // Uptime
  const uptime = process.uptime();
  const seconds = Math.floor(uptime % 60);
  const minutes = Math.floor((uptime / 60) % 60);
  const hours = Math.floor(uptime / 3600);

  // Memory usage
  const rawMem = process.memoryUsage();

  // Build a Record<keyof MemoryUsage, string> in a type-safe way
  const memoryUsage = (
    Object.keys(rawMem) as (keyof NodeJS.MemoryUsage)[]
  ).reduce(
    (acc, key) => {
      acc[key] = formatBytes(rawMem[key]);
      return acc;
    },
    {} as Record<keyof NodeJS.MemoryUsage, string>,
  );

  return {
    nodeVersion: process.version,
    uptime: `${hours} hours, ${minutes} minutes, ${seconds} seconds`,
    memoryUsage,
    timestamp: formatTimestamp(new Date().toISOString()),
  };
}

/**
 * Returns the ISO timestamp of the last full‐index run,
 * or null if never written.
 */
export function getLastIndexedAt(): string | number | undefined {
  if (!existsSync(LAST_INDEX_FILE)) return "";
  return readFileSync(LAST_INDEX_FILE, "utf-8").trim();
}
