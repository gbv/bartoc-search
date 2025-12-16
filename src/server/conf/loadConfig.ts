import fs from "fs";
import path from "path";
import _ from "lodash";
import { validate } from "jsonschema";
import schema from "./schema.json";

function parseConfig(file: string) {
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  if (validate(data, schema)) {
    return data;
  } else {
    // TODO: we could add error details when using Validator class
    throw Error(`Configuration in ${file} is not valid`);
  }
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
