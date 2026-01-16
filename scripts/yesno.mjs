#!/usr/bin/env node
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const rl = readline.createInterface({ input, output })

const answer = (await rl.question("Are you sure you want to continue? [y/N] ")).trim().toLowerCase()
rl.close()

const ok = answer === "y" || answer === "yes"
process.exit(ok ? 0 : 1)
