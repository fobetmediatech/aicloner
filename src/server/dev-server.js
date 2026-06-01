#!/usr/bin/env node
import http from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runModule1 } from "../module1/runner.js";
import { rewritePromptWithGemini } from "../module1/gemini/rewrite.js";
import { resolveCharacter } from "../module1/characters/registry.js";
import { buildOmniVideoPayload } from "../module1/kling/payload.js";
import { KlingClient, extractTaskId, extractTaskStatus, extractVideoUrl } from "../module1/kling/client.js";
import { buildInfluencerVideoPrompt } from "../influencer/visual-pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
loadDotEnv(path.join(rootDir, ".env"));
const publicDir = path.join(rootDir, "public");
const characterDir = path.join(rootDir, "data/characters");
const outputDir = path.join(rootDir, "output/module1");
const uploadDir = path.join(rootDir, "uploads");
const directorInstructionPath = path.join(rootDir, "config/director-instruction.txt");
const port = Number(process.env.PORT || 5173);

function loadDotEnv(envPath) {
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals === -1) continue;
      const key = trimmed.slice(0, equals).trim();
      let value = trimmed.slice(equals + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional.
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/characters" && req.method === "GET") {
      return json(res, await listCharacters());
    }

    if (url.pathname === "/api/config/runtime" && req.method === "GET") {
      return json(res, {
        kling_model: process.env.KLING_MODEL || "kling-video-o1",
        kling_base_url: process.env.KLING_API_BASE_URL || "https://api-singapore.klingai.com",
        kling_access_key_configured: Boolean(process.env.KLING_ACCESS_KEY),
        kling_secret_key_configured: Boolean(process.env.KLING_SECRET_KEY),
        kling_api_token_configured: Boolean(process.env.KLING_API_TOKEN)
      });
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
      const rewrite = await rewritePromptWithGemini({
        instruction: await loadDirectorInstruction(),
        prompt: body.prompt
      });
      const config = buildDryRunConfig({ ...body, prompt: rewrite.output_prompt, gemini_rewrite: rewrite });
      const result = await runModule1(config);
      return json(res, { ...result, gemini_rewrite: summarizeGeminiRewrite(rewrite) }, 201);
    }

    if (url.pathname === "/api/module1/generate-video" && req.method === "POST") {
      const body = await readJson(req);
      const result = await createSingleKlingVideoTask(body);
      return json(res, result, 201);
    }

    if (url.pathname === "/api/influencer/expand-prompt" && req.method === "POST") {
      const body = await readJson(req);
      const result = await expandInfluencerPrompt(body);
      return json(res, result, 201);
    }

    if (url.pathname === "/api/module1/kling-task" && req.method === "GET") {
      const taskId = requiredText(url.searchParams.get("task_id"), "task_id");
      const kling = new KlingClient();
      const response = await kling.queryTask(taskId);
      return json(res, {
        task_id: taskId,
        task_status: extractTaskStatus(response),
        video_url: extractVideoUrl(response),
        response
      });
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

async function createSingleKlingVideoTask(body) {
  const characterId = requiredText(body.character_id, "character_id");
  const prompt = requiredText(body.prompt, "prompt");
  const character = await resolveCharacter({
    character_id: characterId,
    character_registry_dir: "data/characters"
  });

  const clip = {
    index: 1,
    id: "clip_001",
    duration_seconds: Number(process.env.KLING_TEST_DURATION_SECONDS || 10),
    source_prompt: prompt,
    continuity_mode: "initial"
  };

  const video = {
    prompt,
    mode: process.env.KLING_TEST_MODE || "std",
    aspect_ratio: body.aspect_ratio || "9:16",
    use_element_list: false
  };

  const request = buildOmniVideoPayload({
    modelName: process.env.KLING_MODEL || "kling-video-o1",
    prompt,
    character,
    clip,
    video,
    previousEndFrameUrl: null
  });

  const kling = new KlingClient();
  const createResponse = await kling.createOmniVideo(request);
  const immediateVideoUrl = extractVideoUrl(createResponse);
  const taskId = extractTaskId(createResponse);

  if (immediateVideoUrl) {
    return {
      status: "complete",
      video_url: immediateVideoUrl,
      task_id: taskId,
      request,
      create_response: createResponse
    };
  }

  if (!taskId) {
    throw new Error(`Kling response did not include task_id or video URL: ${JSON.stringify(createResponse)}`);
  }

  return {
    status: "submitted",
    task_id: taskId,
    request,
    create_response: createResponse
  };
}

async function expandInfluencerPrompt(body) {
  const characterId = requiredText(body.character_id, "character_id");
  const brief = requiredText(body.prompt, "prompt");
  const character = await loadCharacterDraft(characterId);

  return buildInfluencerVideoPrompt({
    character,
    brief,
    aspectRatio: body.aspect_ratio || "9:16"
  });
}

async function loadCharacterDraft(characterId) {
  const safeId = slug(characterId);
  if (safeId !== characterId) {
    const error = new Error("Invalid character_id");
    error.statusCode = 400;
    throw error;
  }
  const characterPath = safeJoin(characterDir, `${safeId}.json`);
  return JSON.parse(await readFile(characterPath, "utf8"));
}

async function loadDirectorInstruction() {
  if (process.env.DIRECTOR_INSTRUCTION) {
    return process.env.DIRECTOR_INSTRUCTION;
  }
  return readFile(directorInstructionPath, "utf8").catch(() => "");
}

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

function summarizeGeminiRewrite(rewrite) {
  return {
    provider: rewrite.provider,
    model: rewrite.model,
    configured: rewrite.configured,
    input_prompt: rewrite.input_prompt,
    output_prompt: rewrite.output_prompt,
    instruction: rewrite.instruction
  };
}

function buildDryRunConfig(body) {
  const duration = positiveNumber(body.desired_duration_seconds || 10, "desired_duration_seconds");
  const clipLimit = positiveNumber(body.clip_duration_limit_seconds || 10, "clip_duration_limit_seconds");

  return {
    run_id: body.run_id || `run_${new Date().toISOString().replace(/[:.]/g, "-")}`,
    output_dir: body.output_dir || null,
    character_id: requiredText(body.character_id, "character_id"),
    character: body.character || null,
    desired_duration_seconds: duration,
    clip_duration_limit_seconds: clipLimit,
    prompt: requiredText(body.prompt, "prompt"),
    gemini_rewrite: body.gemini_rewrite || null,
    planner: {
      provider: body.planner_provider || "local",
      model: body.planner_model || "demo"
    },
    video: {
      prompt: requiredText(body.prompt, "prompt"),
      original_prompt: body.gemini_rewrite?.input_prompt || body.prompt,
      instruction: body.gemini_rewrite?.instruction || body.instruction || "",
      gemini_rewrite: body.gemini_rewrite || null,
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
      model_name: body.model_name || "omni-v3",
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

function contentType(ext) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  }[ext.toLowerCase()] || "application/octet-stream";
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(data)}\n`);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function requiredText(value, name) {
  const text = String(value || "").trim();
  if (!text) {
    const error = new Error(`Missing required field: ${name}`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function positiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`Invalid ${name}`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `character-${Date.now()}`;
}
