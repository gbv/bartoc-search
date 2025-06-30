import type { RedisOptions } from "ioredis";
import Redis from "ioredis";
import config from "../conf/conf";

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  host: config.redis.host,
};

const redisClient = new Redis(config.redis.url || "", redisOptions);
export default redisClient;
