import { spawn } from "node:child_process";

export async function extractEndFrame({ inputVideoPath, outputFramePath }) {
  await run("ffmpeg", [
    "-y",
    "-sseof",
    "-0.1",
    "-i",
    inputVideoPath,
    "-frames:v",
    "1",
    outputFramePath
  ]);
  return outputFramePath;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr}`));
      }
    });
  });
}
