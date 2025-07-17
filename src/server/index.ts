import { startServer } from "./main";
import * as solr from "./solr/solr";
import config from "./conf/conf";

// Solr Connection
const startSolr = async () => {
  try {
    await solr.connectToSolr();
  } catch (error) {
    config.error?.("Error connecting to Solr" + error);
  }
};

// Starting Solr
startSolr();

// Starting the server
const app = startServer();

export { app };
