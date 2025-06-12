import type { RedisOptions } from "ioredis";
import Redis from "ioredis";
import config from "../conf/conf"; // our conf file

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  host: config.redis.host,
};

console.log(config.redis.url);

const redisClient = new Redis(config.redis.url || "", redisOptions);
export default redisClient;
