#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { runModule1 } from "./runner.js";

const { values } = parseArgs({
  options: {
    config: { type: "string", short: "c" },
    "dry-run": { type: "boolean", default: false }
  }
});

if (!values.config) {
  console.error("Usage: node src/module1/cli.js --config <path> [--dry-run]");
  process.exit(1);
}

const config = await loadConfig(values.config);
if (values["dry-run"]) {
  config.dry_run = true;
}

const result = await runModule1(config);
console.log(JSON.stringify(result, null, 2));
