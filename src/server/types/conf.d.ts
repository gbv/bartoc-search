export interface MongoOptions {
  connectTimeoutMS?: number;
  socketTimeoutMS?: number;
  heartbeatFrequencyMS?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  url?: string;
}

export interface MongoConfig {
  user?: string;
  pass?: string;
  host: string;
  port: number;
  db: string;
  options?: MongoOptions;
  auth?: string;
  url?: string;
}

export interface SolrConfig {
  batch_size: number;
  host: string;
  port: number;
  url?: string;
  version: number;
}

export interface DefaultConfig {
  baseUrl?: string | null;
  closedWorldAssumption?: boolean;
  env: string;
  indexDataAtBoot?: boolean;
  loadNdjsonData?: boolean;
  logLevel: string;
  mongo?: MongoConfig;
  ndJsonDataPath?: string;
  port: number;
  proxies?: string[];
  /** Per‐queue configuration */
  queues?: Record<string, QueueConfig>;
  redis: RedisConfig;
  solr: SolrConfig;
  title?: string;
  verbosity?: Verbosity;
  version?: string | null;
  // Optional helpers & runtime fields
  log?: (...args: string[]) => void;
  warn?: (...args: string[]) => void;
  error?: (...args: string[]) => void;
  getDirname?: (url: string) => string;
  status?: unknown;
}

export interface UserConfig {
  mongo?: MongoConfig;
}

export interface QueueConfig {
  /** Default concurrency for this queue’s worker */
  concurrency?: number;
}

export interface AppConfig extends DefaultConfig, UserConfig {}

export type Verbosity = boolean | "log" | "warn" | "error";
