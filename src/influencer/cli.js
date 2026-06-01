#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadInfluencerVisualConfig, runInfluencerVisualPlan } from "./visual-pipeline.js";

const { values } = parseArgs({
  options: {
    config: { type: "string", short: "c" }
  }
});

if (!values.config) {
  console.error("Usage: node src/influencer/cli.js --config <path>");
  process.exit(1);
}

const config = await loadInfluencerVisualConfig(values.config);
const result = await runInfluencerVisualPlan(config);
console.log(JSON.stringify(result, null, 2));
