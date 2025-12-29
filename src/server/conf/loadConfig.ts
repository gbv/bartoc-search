import fs from "fs";
import path from "path";
import _ from "lodash";
import { validate } from "jsonschema";
import schema from "./schema.json";

function parseConfig(file: string) {
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  // validate does return ValidatorResult, not a boolean
  const result = validate(data, schema);
  
  if (!result.valid) {
    const msg = result.errors.map(e => `- ${e.stack}`).join("\n");
    throw new Error(`Configuration in ${file} is not valid:\n${msg}`);
  }

  return data;
}

export function loadConfig(defaultPath: string, userPath: string) {
  defaultPath = path.resolve(defaultPath);
  userPath = path.resolve(userPath);

  const defaultConfig = parseConfig(defaultPath);

  let userConfig = {};
  if (fs.existsSync(userPath)) { // Ignore missing or empty user config
    const raw = fs.readFileSync(userPath, "utf-8").trim();
    if (raw.length > 0) {
      userConfig = parseConfig(userPath);
    }
  }

  // Deep merge (user overrides defaults)
  return _.defaultsDeep({}, userConfig, defaultConfig);
}
