import mongoose from "mongoose";
import config from "../conf/conf";
import { Meta, MetaDocument } from "../models/meta";
import { Terminology } from "../models/terminology";
import { terminologyZodSchema } from "./terminologySchemaValidation";
import fs from "fs";
import readline from "readline";

const checkAndInitDbCollections = async (
  connection: mongoose.Connection,
  version: string,
) => {
  if (!connection?.db) {
    config.error?.("❌ MongoDB connection is not available.");
    return;
  }

  try {
    const collections = (await connection.db.listCollections().toArray()).map(
      (c) => c.name,
    );

    const hasTerminologies = collections.some((c) => c === "terminologies");
    const hasMeta = collections.some((c) => c === "meta");

    if (!hasMeta) {
      try {
        const metaCollection: MetaDocument = new Meta({ version });
        await metaCollection.save();
        config.log?.("📦 Created new meta collection with version:", version);
      } catch (err) {
        config.error?.(
          "❌ Failed to create meta collection:",
          (err as Error).message,
        );
      }
    }

    if (!hasTerminologies) {
      try {
        await mongoose.connection.createCollection("terminologies");
        config.log?.(
          "📦 Created terminologies collection because it didn't exist.",
        );

        const docCount = await mongoose.connection
          .collection("terminologies")
          .countDocuments();

        if (docCount === 0) {
          config.warn?.("📭 'terminologies' collection is empty.");

          if (config.loadNdjsonData) {
            const filePath = config.ndJsonDataPath ?? "";
            config.log?.(`📂 Starting NDJSON import from: ${filePath}`);
            await importFromNDJSON(filePath);
          }
        }
      } catch (err) {
        config.error?.(
          "❌ Failed to create terminologies collection:",
          (err as Error).message,
        );
      }
    }
  } catch (error) {
    config.error?.(
      `❌ MongoDB connection is not available with error ${error}`,
    );
  }
};

export async function importFromNDJSON(filePath: string): Promise<void> {
  if (!filePath) {
    config.error?.("❌ Problem with path");
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let success = 0;
  let errors = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      const validation = terminologyZodSchema.safeParse(parsed);
      if (!validation.success) {
        config.error?.(
          "❌ Validation failed because of:",
          JSON.stringify(validation.error.format(), null, 2),
        );
        errors++;
        continue;
      }

      const terminology = new Terminology(validation.data);
      await terminology.save();
      success++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      config.error?.("❌ Failed to process line:", message);
      errors++;
    }
  }

  config.log?.(`📊 Total documents are ${success + errors}`);
  config.log?.(`✅ Loaded ${success} documents`);
  config.log?.(`❌ Errors of validation in ${errors} documents`);
}

export default checkAndInitDbCollections;
