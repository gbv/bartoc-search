import { startServer } from "./main";
import * as solr from "./solr/solr";
import config from "./conf/conf";
import { connectToRedis } from "./redis/redis";

/* // Solr Connection
const startSolr = async () => {
  try {
    await solr.connectToSolr();
  } catch (error) {
    config.error?.("Error connecting to Solr");
  }
};

// Starting Solr
startSolr(); */

// Redis connection

const startRedis = async () => {
  try {
    await connectToRedis();
  } catch (error) {
    config.error?.("Error connecting to Redis");
  }
};

// Starting Solr
// startRedis();

// Starting the server
const app = startServer();

export { app };
