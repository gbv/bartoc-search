import { startServer } from "./main";
import * as solr from "./solr/solr";
import config from "./conf/conf";

// Solr Connection
const startSolr = async () => {
  try {
    await solr.connectToSolr();
  } catch (error) {
    config.error?.("Error connecting to Solr" + error);
    if (process.env.NODE_ENV === "test") throw error;
  }
};

(async () => {
  await startSolr();
  if (process.env.NODE_ENV !== "test") {
    await startServer();
  }
})();

export {};




