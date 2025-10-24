// src/server/utils/loadConfig.ts
import fs from "fs";
import path from "path";
import _ from "lodash";
import {
  defaultConfigSchema,
  userConfigSchema,
  type AppConfig,
} from "../conf/configValidation";


/**
 * Load application configuration by merging a required default config
 * with an optional user override. Both parts are validated:
 * - default config must be fully valid (strict schema)
 * - user config may be partial (override schema)
 *
 * This function is CI-friendly: if the user config file is missing or empty,
 * it simply falls back to defaults without throwing ENOENT.
 */
export function loadConfig(defaultPath: string, userPath: string): AppConfig {
  // Resolve absolute file paths to avoid surprises with process.cwd()
  const defaultAbs = path.resolve(defaultPath);
  const userAbs = path.resolve(userPath);

  // --- 1) Load & validate default config ---
  // Read and parse the default config. This must exist and be valid,
  // or we fail fast because defaults define the full shape.
  const defaultJson = JSON.parse(fs.readFileSync(defaultAbs, "utf-8"));
  const defaultParsed = defaultConfigSchema.parse(defaultJson);

  // --- 2) Load & validate user config (OPTIONAL) ---
  // The user config may not exist in CI/dev; treat it as {} if missing/empty.
  // When present, validate as a partial override so only provided keys are checked.
  let userParsed: Partial<AppConfig> = {};

  if (fs.existsSync(userAbs)) {
    const raw = fs.readFileSync(userAbs, "utf-8").trim();
    if (raw.length > 0) {
      // Validate as partial/override
      const parsed = userConfigSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        // Be explicit to help in CI logs
        const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new Error(`Invalid user config at ${userAbs}: ${msg}`);
      }
      userParsed = parsed.data as Partial<AppConfig>;
    }
  }

   // --- 3) Merge (user overrides defaults) ---
  // Deep-merge so nested structures are overridden key-by-key.
  // _.defaultsDeep applies properties from right to left (last is the fallback).
  const finalConfig: AppConfig = _.defaultsDeep({}, userParsed, defaultParsed);
  return finalConfig;
}

