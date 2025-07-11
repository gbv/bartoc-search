// src/utils/loadConfig.ts
import fs from "fs"
import path from "path"
import {
  defaultConfigSchema,
  AppConfig,
  userConfigSchema,
} from "../conf/configValidation"
import _ from "lodash"

export function loadConfig(defaultPath: string, userPath: string): AppConfig {
  const defaultRaw = JSON.parse(
    fs.readFileSync(path.resolve(defaultPath), "utf-8"),
  )
  const userRaw = JSON.parse(fs.readFileSync(path.resolve(userPath), "utf-8"))

  // Validate separately
  const defaultParsed = defaultConfigSchema.parse(defaultRaw) // throws if invalid
  const userParsed = userConfigSchema.parse(userRaw) // allows partial

  // Deep merge
  const finalConfig: AppConfig = _.defaultsDeep({}, userParsed, defaultParsed)

  return finalConfig
}
