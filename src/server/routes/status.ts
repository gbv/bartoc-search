import { Request, Response } from "express";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
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

  // mongo
  const mongoConnected = mongoose.connection.readyState === 1;

  //solr
  const solrStatus = await solr.solrStatus();
  const solrStatusResult: SolrStatusResult = mapSolrToStatus(solrStatus);

  const statusResponse: StatusResponse = {
    ok: true,
    appVersion,
    runtimeInfo,
    services: {
      mongo: { connected: mongoConnected },
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
    environment: process.env.NODE_ENV ?? "development",
    timestamp: formatTimestamp(new Date().toISOString()),
  };
}
