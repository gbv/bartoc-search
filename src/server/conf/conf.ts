import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import type { AppConfig, Verbosity } from "../types/conf";
import { loadConfig } from "../utils/loadConfig";
import packageInfo from "../../../package.json";

// Prepare environment
dotenv.config();
const env = process.env.NODE_ENV ?? "development";
const configFile = process.env.CONFIG_FILE || "./config/config.json";
const defaultFile = "./config/config.default.json";
const ndJsonFile = "./data/latest.ndjson";
const configFilePath = path.resolve(process.cwd(), configFile);
const defaultFilePath = path.resolve(process.cwd(), defaultFile);
const dataFilePath = path.resolve(process.cwd(), ndJsonFile);
export const infoPackage = packageInfo;

// If file doesn't exist, create it with an empty object
if (env !== "test" && !fs.existsSync(configFilePath)) {
  fs.writeFileSync(configFilePath, "{}");
}

// Merging config.default.json and config.json
const config: AppConfig = loadConfig(defaultFilePath, configFilePath);

// Set composed config variables
const redisHost = process.env.REDIS_HOST ?? config.redis.host;

const redisPort = process.env.REDIS_PORT
  ? Number(process.env.REDIS_PORT)
  : config.redis.port;

// Build redis url for local development
config.redis.url = `redis://${redisHost}:${redisPort}`;

const solrHost = process.env.SOLR_HOST ?? config.solr.host;

const solrPort = process.env.SOLR_PORT
  ? Number(process.env.SOLR_PORT)
  : config.solr.port;

// Build solr url, basic only for local development
config.solr.url = `http://${solrHost}:${solrPort}/solr`;

// Build ndJson data path, from latest.ndjson
if (config.indexDataAtBoot && config.indexDataAtBoot === true) {
  config.ndJsonDataPath = dataFilePath;
}

// Logging section
function isValidVerbosity(v: unknown): v is Verbosity {
  return [true, false, "log", "warn", "error"].includes(v as string);
}

if (!isValidVerbosity(config.verbosity)) {
  console.warn(
    `Invalid verbosity value "${config.verbosity}", defaulting to "${config.verbosity}" instead.`,
  );
}

// Logging methods
config.log = (...args: unknown[]) => {
  if (
    config.env !== "test" &&
    (config.verbosity === true || config.verbosity === "log")
  ) {
    console.log(new Date(), ...args);
  }
};

config.warn = (...args: unknown[]) => {
  if (
    config.env !== "test" &&
    (config.verbosity === true ||
      config.verbosity === "log" ||
      config.verbosity === "warn")
  ) {
    console.warn(new Date(), ...args);
  }
};

config.error = (...args: unknown[]) => {
  if (config.env !== "test" && config.verbosity !== false) {
    console.error(new Date(), ...args);
  }
};

export default config;
