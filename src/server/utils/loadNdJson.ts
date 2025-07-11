import * as fs from "fs"
import * as readline from "readline"
import { ZodSchema } from "zod"
import config from "../conf/conf"

/**
 * Reads an NDJSON file, validates each line using the provided Zod schema,
 * and returns an array of valid parsed objects.
 *
 * @param filePath - Path to the NDJSON file.
 * @param schema - Zod schema to validate each entry.
 * @returns Promise with array of parsed and validated objects.
 */
export default async function readAndValidateNdjson<T>(
  filePath: string,
  schema: ZodSchema<T>,
): Promise<T[]> {
  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" })

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  const results: T[] = []
  let lineNumber: number = 0
  let errorCount: number = 0

  for await (const line of rl) {
    lineNumber++
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    } // Skip empty lines

    try {
      const json = JSON.parse(trimmed)
      const validated = schema.parse(json) // Throws if invalid
      results.push(validated)
    } catch (error) {
      errorCount++
      config.error?.(
        `Line ${lineNumber}: Skipped invalid record. Error: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  config.log?.(`Finished reading ${filePath}.`)
  config.log?.(`Valid items: ${results.length}`)
  config.error?.(`[ERROR] Invalid lines skipped: ${errorCount}`)

  return results
}
