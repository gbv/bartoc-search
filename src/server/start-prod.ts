import { startServer } from "./main";
import * as solr from "./solr/solr";
import config from "./conf/conf";

async function startSolr() {
  try {
    await solr.connectToSolr();
  } catch (error) {
    config.error?.("Error connecting to Solr" + error);
    process.exit(1);
  }
}

(async () => {
  await startSolr();

  await startServer({
    withVite: false,      // no Vite dev server in production
    withWorkers: process.env.DISABLE_WORKERS !== "1", // enable workers unless explicitly disabled
    withUpdater: true,    // automatic data updater in production
    withFrontend: true,   // it serves the frontend in production
    });

})();
