// src/utils/loadConfig.ts
import fs from "fs";
import path from "path";
import { configSchema, AppConfig } from "../conf/configValidation";

export function loadConfig(filePath: string): AppConfig {
  const fullPath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const parsed = JSON.parse(raw);

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    console.error("❌ Config validation failed:", result.error.format());
    throw new Error("Invalid config");
  }

  return result.data;
}
