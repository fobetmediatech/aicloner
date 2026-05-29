#!/usr/bin/env node
import http from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runModule1 } from "../module1/runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const publicDir = path.join(rootDir, "public");
const characterDir = path.join(rootDir, "data/characters");
const outputDir = path.join(rootDir, "output/module1");
const uploadDir = path.join(rootDir, "uploads");
const port = Number(process.env.PORT || 5173);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/characters" && req.method === "GET") {
      return json(res, await listCharacters());
    }

    if (url.pathname === "/api/characters" && req.method === "POST") {
      const body = await readJson(req);
      const character = await saveCharacter(body);
      await mkdir(characterDir, { recursive: true });
      await writeFile(path.join(characterDir, `${character.id}.json`), `${JSON.stringify(character, null, 2)}\n`);
      return json(res, character, 201);
    }

    if (url.pathname === "/api/module1/dry-run" && req.method === "POST") {
      const body = await readJson(req);
      const config = buildDryRunConfig(body);
      const result = await runModule1(config);
      return json(res, result, 201);
    }

    if (url.pathname === "/api/runs" && req.method === "GET") {
      return json(res, await listRuns());
    }

    const manifestMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/manifest$/);
    if (manifestMatch && req.method === "GET") {
      const runId = decodeURIComponent(manifestMatch[1]);
      const manifestPath = safeJoin(outputDir, runId, "manifest.json");
      return json(res, JSON.parse(await readFile(manifestPath, "utf8")));
    }

    if (url.pathname.startsWith("/uploads/")) {
      return serveUpload(url.pathname, res);
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    return json(res, { error: error.message }, error.statusCode || 500);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Module 1 UI: http://127.0.0.1:${port}`);
});

async function listCharacters() {
  await mkdir(characterDir, { recursive: true });
  const files = await readdir(characterDir);
  const characters = [];
  for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
    const raw = await readFile(path.join(characterDir, file), "utf8");
    characters.push(JSON.parse(raw));
  }
  return characters;
}

async function listRuns() {
  await mkdir(outputDir, { recursive: true });
  const entries = await readdir(outputDir, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(outputDir, entry.name, "manifest.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      runs.push({
        run_id: entry.name,
        status: manifest.status,
        character_id: manifest.character_id,
        clip_count: manifest.clips?.length || 0,
        desired_duration_seconds: manifest.desired_duration_seconds,
        output_dir: manifest.output_dir
      });
    } catch {
      // Ignore incomplete run folders.
    }
  }
  runs.sort((a, b) => b.run_id.localeCompare(a.run_id));
  return runs;
}

function buildDryRunConfig(body) {
  const duration = positiveNumber(body.desired_duration_seconds || 10, "desired_duration_seconds");
  const clipLimit = positiveNumber(body.clip_duration_limit_seconds || 10, "clip_duration_limit_seconds");
  return {
    run_name: body.run_name || "ui-module1-dry-run",
    output_dir: "output/module1",
    dry_run: true,
    character_registry_dir: "data/characters",
    character_id: requiredText(body.character_id, "character_id"),
    storage: {
      public_base_url: body.public_base_url || "https://example.com/module1-assets"
    },
    video: {
      prompt: requiredText(body.prompt, "prompt"),
      desired_duration_seconds: duration,
      clip_duration_limit_seconds: clipLimit,
      aspect_ratio: body.aspect_ratio || "16:9",
      mode: body.mode || "pro"
    },
    director: {
      style: body.director_style || "",
      negative_instructions: body.negative_instructions || ""
    },
    kling: {
      model_name: body.model_name || "kling-video-o1",
      base_url: body.base_url || "https://api-singapore.klingai.com",
      task_status_path_template: null
    }
  };
}

async function saveCharacter(body) {
  const character = normalizeCharacter(body);
  const characterUploadDir = path.join(uploadDir, "characters", character.id);
  const imageDir = path.join(characterUploadDir, "images");
  const voiceDir = path.join(characterUploadDir, "voice");
  await mkdir(imageDir, { recursive: true });
  await mkdir(voiceDir, { recursive: true });

  const savedImages = [];
  for (const [index, file] of character.uploads.images.entries()) {
    const saved = await saveDataUrlFile({
      file,
      dir: imageDir,
      fallbackName: `image_${String(index + 1).padStart(2, "0")}`
    });
    savedImages.push(saved.public_url);
  }

  const voiceSample = character.uploads.voice
    ? await saveDataUrlFile({ file: character.uploads.voice, dir: voiceDir, fallbackName: "voice_sample" })
    : null;

  return {
    id: character.id,
    display_name: character.display_name,
    consent_status: "pending",
    source_status: "draft",
    kling_element_id: null,
    kling_voice_id: null,
    reference_images: savedImages,
    voice_sample: voiceSample?.public_url || null,
    asset_counts: {
      reference_images: savedImages.length,
      voice_samples: voiceSample ? 1 : 0
    },
    created_at: new Date().toISOString()
  };
}

function normalizeCharacter(body) {
  const displayName = requiredText(body.display_name, "display_name");
  const id = slug(body.id || displayName);
  const images = Array.isArray(body.images) ? body.images : [];
  const voice = body.voice_sample || null;

  if (images.length === 0) {
    throw new Error("At least one reference image is required for the demo upload flow");
  }

  return {
    id,
    display_name: displayName,
    uploads: {
      images,
      voice
    }
  };
}

async function saveDataUrlFile({ file, dir, fallbackName }) {
  if (!file || !file.data_url) throw new Error("Uploaded file is missing data_url");
  const match = String(file.data_url).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error(`Invalid data URL for ${file.name || fallbackName}`);
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = extensionForMime(mimeType, file.name);
  const safeName = `${fallbackName}${ext}`;
  const diskPath = path.join(dir, safeName);
  await writeFile(diskPath, buffer);
  const relative = path.relative(rootDir, diskPath).split(path.sep).join("/");
  return {
    filename: safeName,
    mime_type: mimeType,
    size_bytes: buffer.length,
    storage_uri: relative,
    public_url: `/${relative}`
  };
}

function extensionForMime(mimeType, originalName = "") {
  const ext = path.extname(originalName).toLowerCase();
  if (ext && ext.length <= 8) return ext;
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm"
  }[mimeType] || ".bin";
}

async function serveUpload(pathname, res) {
  const filePath = pathname.replace(/^\/+/, "");
  const resolved = safeJoin(rootDir, filePath);
  const info = await stat(resolved).catch(() => null);
  if (!info || !info.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(path.extname(resolved)) });
  res.end(await readFile(resolved));
}

async function serveStatic(pathname, res) {
  const filePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = safeJoin(publicDir, filePath);
  const info = await stat(resolved).catch(() => null);
  if (!info || !info.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(resolved);
  res.writeHead(200, { "Content-Type": contentType(ext) });
  res.end(await readFile(resolved));
}

function safeJoin(base, ...parts) {
  const resolved = path.resolve(base, ...parts);
  const normalizedBase = path.resolve(base);
  if (resolved !== normalizedBase && !resolved.startsWith(`${normalizedBase}${path.sep}`)) {
    const error = new Error("Invalid path");
    error.statusCode = 400;
    throw error;
  }
  return resolved;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 200_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function json(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(value, null, 2)}\n`);
}

function requiredText(value, key) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${key} is required`);
  return text;
}

function positiveNumber(value, key) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${key} must be positive`);
  return number;
}

function emptyToNull(value) {
  const text = String(value || "").trim();
  return text ? text : null;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function contentType(ext) {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}
