import { startServer } from "./main";
import * as db from "./mongo/mongo";
import * as solr from "./solr/solr";
import { watchTerminologies } from "./mongo/watchTerminologies";
import config from "./conf/conf";

const mongoDbConnection = db.connection;

// Database connection
const startMongoDB = async () => {
  try {
    await db.connect(true);
  } catch (error) {
    config.warn?.(
      "Error connecting to database, reconnect in a few seconds...",
    );
  }

  if (config.indexDataAtBoot) {
    await solr.indexDataAtBoot();
  }

  // Watching for changes in realt time, only for inserting events
  await watchTerminologies();
};

// Solr Connection
const startSolr = async () => {
  try {
    await solr.connectToSolr();
  } catch (error) {
    config.error?.("Error connecting to Solr");
  }
};

// Startig and try connection to the mongodb instance
startMongoDB();

// Starting Solr
startSolr();

// Starting the server without wait for mongodb connection
const app = startServer();

export { app, mongoDbConnection };
