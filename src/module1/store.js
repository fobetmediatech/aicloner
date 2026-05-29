import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createRunStore({ outputDir, runName }) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(runName)}`;
  const runDir = path.join(outputDir, runId);
  const dirs = {
    root: runDir,
    clips: path.join(runDir, "clips"),
    frames: path.join(runDir, "frames"),
    requests: path.join(runDir, "requests"),
    responses: path.join(runDir, "responses")
  };

  await Promise.all(Object.values(dirs).map((dir) => mkdir(dir, { recursive: true })));

  return {
    runId,
    dirs,
    pathFor(kind, filename) {
      return path.join(dirs[kind], filename);
    },
    writeJson(filename, value) {
      return writeFile(path.join(runDir, filename), `${JSON.stringify(value, null, 2)}\n`);
    },
    writeRequest(clipId, value) {
      return writeFile(path.join(dirs.requests, `${clipId}.request.json`), `${JSON.stringify(value, null, 2)}\n`);
    },
    writeResponse(clipId, value) {
      return writeFile(path.join(dirs.responses, `${clipId}.response.json`), `${JSON.stringify(value, null, 2)}\n`);
    }
  };
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
