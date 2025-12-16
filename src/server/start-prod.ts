import { startServer } from "./main";
import * as solr from "./solr/solr";
import config from "./conf/conf";

async function startSolr() {
  try {
    await solr.connectToSolr();
  } catch (error) {
    config.error?.("Error connecting to Solr" + error);
    // in prod è meglio non “andare avanti lo stesso”
    process.exit(1);
  }
}

(async () => {
  await startSolr();

  await startServer({
    withVite: false,      // no Vite dev server in production
    withWorkers: false,   // no background workers in production
    withUpdater: true,    // automatic data updater in production
    withFrontend: true,   // it serves the frontend in production
    });

})();
