import { readFile } from "node:fs/promises";

export async function loadConfig(path) {
  const raw = await readFile(path, "utf8");
  const config = JSON.parse(raw);
  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  const required = [
    ["run_name", config.run_name],
    ["output_dir", config.output_dir],
    ["character_id or character", config.character_id || config.character?.id],
    ["video.prompt", config.video?.prompt],
    ["video.desired_duration_seconds", config.video?.desired_duration_seconds],
    ["video.clip_duration_limit_seconds", config.video?.clip_duration_limit_seconds],
    ["kling.model_name", config.kling?.model_name]
  ];

  const missing = required
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing config fields: ${missing.join(", ")}`);
  }

  if (config.video.clip_duration_limit_seconds < 3) {
    throw new Error("video.clip_duration_limit_seconds must be at least 3 seconds");
  }
}
