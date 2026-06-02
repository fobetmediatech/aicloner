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
        kling_image_model: process.env.KLING_IMAGE_MODEL || "kling-v2-1",
        kling_image_create_path: process.env.KLING_IMAGE_CREATE_PATH || "/v1/images/generations",
        kling_base_url: process.env.KLING_API_BASE_URL || "https://api-singapore.klingai.com",
        kling_access_key_configured: Boolean(process.env.KLING_ACCESS_KEY),
        kling_secret_key_configured: Boolean(process.env.KLING_SECRET_KEY),
        kling_api_token_configured: Boolean(process.env.KLING_API_TOKEN),
        gemini_image_model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
        gemini_api_key_configured: Boolean(process.env.GEMINI_API_KEY)
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

    if (url.pathname === "/api/influencer/prompt-questions" && req.method === "POST") {
      const body = await readJson(req);
      const result = await buildInfluencerPromptQuestions(body);
      return json(res, result, 201);
    }

    if (url.pathname === "/api/influencer/generate-character" && req.method === "POST") {
      const body = await readJson(req);
      const result = await generateInfluencerCharacter(body);
      return json(res, result, 201);
    }

    if (url.pathname === "/api/influencer/publish-character-sheet" && req.method === "POST") {
      const body = await readJson(req);
      const result = await publishCharacterSheet(body);
      return json(res, result, 201);
    }

    if (url.pathname === "/api/influencer/select-character-sheet" && req.method === "POST") {
      const body = await readJson(req);
      const result = await selectCharacterSheet(body);
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

async function publishCharacterSheet(body) {
  const characterId = requiredText(body.character_id, "character_id");
  const safeId = slug(characterId);
  if (safeId !== characterId) {
    const error = new Error("Invalid character_id");
    error.statusCode = 400;
    throw error;
  }

  const characterPath = safeJoin(characterDir, `${safeId}.json`);
  const character = JSON.parse(await readFile(characterPath, "utf8"));
  const localUrl = character.character_sheet_local_url || character.character_sheet_url;
  if (!localUrl || /^https?:\/\//.test(localUrl)) {
    return {
      status: "already_public_or_missing_local_sheet",
      character,
      message: "Character sheet is already public or no local sheet exists."
    };
  }

  const localPath = safeJoin(publicDir, localUrl.replace(/^\/+/, ""));
  const info = await stat(localPath).catch(() => null);
  if (!info || !info.isFile()) {
    const error = new Error(`Local character sheet file not found: ${localUrl}`);
    error.statusCode = 404;
    throw error;
  }

  const rawUrl = `https://raw.githubusercontent.com/fobetmediatech/aicloner/bhavish/public/${localUrl.replace(/^\/+/, "")}`;
  character.reference_images = [rawUrl];
  character.character_sheet_url = rawUrl;
  character.publish_status = "needs_git_push";
  character.generation = {
    ...(character.generation || {}),
    publish_note: "Run git add/commit/push for this character sheet before using it for Kling video generation."
  };
  await writeFile(characterPath, `${JSON.stringify(character, null, 2)}\n`);

  return {
    status: "needs_git_push",
    character,
    raw_url: rawUrl,
    files_to_push: [
      path.relative(rootDir, characterPath).split(path.sep).join("/"),
      localUrl.replace(/^\/+/, "")
    ],
    message: "Character JSON now points to the future raw GitHub URL. Commit and push the listed files before generating video."
  };
}

async function selectCharacterSheet(body) {
  const characterId = requiredText(body.character_id, "character_id");
  const sheetUrl = requiredText(body.character_sheet_url, "character_sheet_url");
  const safeId = slug(characterId);
  if (safeId !== characterId) {
    const error = new Error("Invalid character_id");
    error.statusCode = 400;
    throw error;
  }
  if (/^https?:\/\//.test(sheetUrl)) {
    const error = new Error("Only local generated character sheets can be selected here.");
    error.statusCode = 400;
    throw error;
  }

  const characterPath = safeJoin(characterDir, `${safeId}.json`);
  const character = JSON.parse(await readFile(characterPath, "utf8"));
  const options = Array.isArray(character.character_sheet_options) ? character.character_sheet_options : [];
  if (!options.includes(sheetUrl)) {
    const error = new Error("Selected character sheet is not one of this character's generated options.");
    error.statusCode = 400;
    throw error;
  }

  const localPath = safeJoin(publicDir, sheetUrl.replace(/^\/+/, ""));
  const info = await stat(localPath).catch(() => null);
  if (!info || !info.isFile()) {
    const error = new Error(`Selected character sheet file not found: ${sheetUrl}`);
    error.statusCode = 404;
    throw error;
  }

  character.character_sheet_local_url = sheetUrl;
  character.character_sheet_url = sheetUrl;
  character.selected_character_sheet_url = sheetUrl;
  character.publish_status = "local_only";
  character.generation = {
    ...(character.generation || {}),
    selected_character_sheet_url: sheetUrl,
    selected_at: new Date().toISOString()
  };
  await writeFile(characterPath, `${JSON.stringify(character, null, 2)}\n`);

  return {
    status: "selected",
    character,
    character_sheet_url: sheetUrl,
    message: "Selected character sheet saved. Use this character in Step 1 or prepare the public URL before Kling video."
  };
}

async function expandInfluencerPrompt(body) {
  const characterId = requiredText(body.character_id, "character_id");
  const brief = requiredText(body.prompt, "prompt");
  const character = await loadCharacterDraft(characterId);

  if (Array.isArray(body.questionnaire_answers) && body.questionnaire_answers.length) {
    return buildGeminiDirectedVideoPrompt({
      character,
      brief,
      aspectRatio: body.aspect_ratio || "9:16",
      questionnaireAnswers: body.questionnaire_answers
    });
  }

  return buildInfluencerVideoPrompt({
    character,
    brief,
    aspectRatio: body.aspect_ratio || "9:16"
  });
}

async function buildInfluencerPromptQuestions(body) {
  const characterId = requiredText(body.character_id, "character_id");
  const brief = requiredText(body.prompt, "prompt");
  const character = await loadCharacterDraft(characterId);
  const existingAnswers = Array.isArray(body.questionnaire_answers) ? body.questionnaire_answers : [];

  const instruction = [
    "You are a senior cinematic director and prompt engineer for AI influencer videos.",
    "Ask only questions that materially improve a 10-second directed video prompt.",
    "Focus on visual storytelling, emotional tone, camera language, location, action, dialogue, pacing, lighting, wardrobe continuity, and avoidances.",
    existingAnswers.length
      ? "The user has already answered some questions. Ask only the missing follow-up questions still needed for clear direction. If everything is clear, return an empty questions array."
      : "Ask around 10 concise questions. Do not exceed 10.",
    "Return strict JSON only, with this shape: {\"questions\":[{\"id\":\"q1\",\"question\":\"...\",\"hint\":\"...\"}]}"
  ].join(" ");

  const text = await callGeminiText({
    instruction,
    prompt: JSON.stringify({
      character: summarizeCharacterForPrompt(character),
      basic_video_idea: brief,
      existing_answers: existingAnswers
    }, null, 2),
    temperature: 0.55
  });

  const parsed = parseJsonObject(text);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : fallbackDirectorQuestions();
  return {
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    questions: questions.slice(0, existingAnswers.length ? 5 : 10).map((item, index) => ({
      id: slug(item.id || `q${index + 1}`),
      question: String(item.question || "").trim(),
      hint: String(item.hint || "").trim()
    })).filter((item) => item.question)
  };
}

async function buildGeminiDirectedVideoPrompt({ character, brief, aspectRatio, questionnaireAnswers }) {
  const instruction = [
    "You are a senior cinematic director and prompt engineer.",
    "Write a highly detailed, production-ready prompt for a 10-second AI influencer video.",
    "The prompt must be dense, cinematic, and specific. It should read like a director's shot plan for a premium commercial or creator film, not like a short generic prompt.",
    "The output must be strict JSON only.",
    "Use this shape: {\"prompt\":\"...\",\"shots\":[{\"time\":\"0-2s\",\"framing\":\"...\",\"camera_motion\":\"...\"}],\"dialogue\":[{\"time\":\"0-3s\",\"line\":\"...\"}],\"audio\":\"...\"}.",
    "The prompt field must be 450-800 words.",
    "The prompt field must include these sections as plain text inside the prompt: CORE CONCEPT, CHARACTER LOCK, VISUAL STYLE, SHOT-BY-SHOT DIRECTION, CAMERA LANGUAGE, PERFORMANCE, LIGHTING AND COLOR, ENVIRONMENT, AUDIO AND DIALOGUE, CONTINUITY RULES, NEGATIVE INSTRUCTIONS.",
    "Use 5 shots for a 10-second video: 0-2s, 2-4s, 4-6s, 6-8s, 8-10s.",
    "Every shot must specify framing, subject action, facial visibility, lens feel, camera motion, focus behavior, and transition logic.",
    "Prefer medium, medium close-up, close-up, and tight profile shots unless the user explicitly requested wide shots.",
    "The face must remain sharp, identity-consistent, and visible in every shot.",
    "Include cinematic details: 85mm lens, shallow depth of field, motivated light, foreground/background movement, natural micro-expressions, wardrobe continuity, realistic skin texture, and controlled camera motion.",
    "The result should feel cinematic, directed, premium, and visually specific."
  ].join(" ");

  const text = await callGeminiText({
    instruction,
    prompt: JSON.stringify({
      character: summarizeCharacterForPrompt(character),
      basic_video_idea: brief,
      aspect_ratio: aspectRatio,
      questionnaire_answers: questionnaireAnswers
    }, null, 2),
    temperature: 0.72
  });

  const parsed = parseJsonObject(text);
  if (!parsed?.prompt) {
    return buildInfluencerVideoPrompt({ character, brief, aspectRatio });
  }

  const prompt = String(parsed.prompt).trim();

  return {
    duration_seconds: 10,
    aspect_ratio: aspectRatio,
    basic_prompt: brief,
    prompt,
    shots: Array.isArray(parsed.shots) ? parsed.shots : [],
    dialogue: Array.isArray(parsed.dialogue) ? parsed.dialogue : [],
    audio: parsed.audio || "clean crisp dialogue, natural location ambience, no music unless requested",
    questionnaire_answers: questionnaireAnswers,
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview"
  };
}

async function generateInfluencerCharacter(body) {
  const displayName = requiredText(body.display_name, "display_name");
  const basePrompt = requiredText(body.prompt, "prompt");
  const characterId = slug(body.id || displayName);
  const aspectRatio = body.aspect_ratio || "9:16";
  const imagePrompt = buildCharacterSheetPrompt(basePrompt, aspectRatio);
  const generatedSheets = [];
  for (let index = 1; index <= 4; index += 1) {
    generatedSheets.push(await generateGeminiCharacterSheet({
      characterId,
      prompt: buildCharacterSheetVariantPrompt(imagePrompt, index, 4),
      variantIndex: index
    }));
  }
  const primarySheet = generatedSheets[0];
  const referenceImages = generatedSheets.map((sheet) => sheet.public_url);
  const character = {
    id: characterId,
    display_name: displayName,
    consent_status: "synthetic-character",
    source_status: "gemini_character_sheet_generated",
    kling_element_id: null,
    kling_voice_id: null,
    reference_images: [],
    character_sheet_local_url: primarySheet.public_url,
    character_sheet_url: primarySheet.public_url,
    character_sheet_options: referenceImages,
    publish_status: "local_only",
    asset_counts: {
      reference_images: 0,
      voice_samples: 0
    },
    generation: {
      provider: "gemini",
      image_model: primarySheet.model,
      generated_sheet_count: generatedSheets.length,
      aspect_ratio: aspectRatio,
      prompt: basePrompt,
      expanded_image_prompt: imagePrompt,
      note: "Generated as a local character sheet. Publish it before Kling video generation so Kling can fetch the image over HTTPS."
    },
    created_at: new Date().toISOString()
  };

  await mkdir(characterDir, { recursive: true });
  await writeFile(path.join(characterDir, `${character.id}.json`), `${JSON.stringify(character, null, 2)}\n`);

  return {
    status: "ready",
    character,
    character_sheet_url: primarySheet.public_url,
    character_sheet_options: referenceImages,
    reference_images: referenceImages,
    publish_status: character.publish_status,
    response_text: generatedSheets.map((sheet) => sheet.response_text).filter(Boolean).join("\n")
  };
}

async function generateGeminiCharacterSheet({ characterId, prompt, variantIndex = 1 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Set GEMINI_API_KEY in .env to generate character sheets");
  }

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    const detail = typeof body === "object" ? JSON.stringify(body) : text;
    throw new Error(`Gemini image API ${response.status} ${response.statusText}: ${detail}`);
  }

  const parts = body?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  if (!imagePart) {
    throw new Error(`Gemini did not return an image: ${JSON.stringify(body)}`);
  }

  const inline = imagePart.inlineData || imagePart.inline_data;
  const ext = extensionForMime(inline.mimeType || inline.mime_type || "image/png");
  const relativeDir = `generated-characters/${characterId}`;
  const diskDir = path.join(publicDir, relativeDir);
  await mkdir(diskDir, { recursive: true });
  const filename = `character-sheet-${Date.now()}-${variantIndex}${ext}`;
  await writeFile(path.join(diskDir, filename), Buffer.from(inline.data, "base64"));

  return {
    model,
    public_url: `/${relativeDir}/${filename}`,
    response_text: parts.filter((part) => part.text).map((part) => part.text).join("\n")
  };
}

function buildCharacterSheetPrompt(basePrompt, aspectRatio) {
  return [
    basePrompt,
    `image aspect ratio ${aspectRatio}`,
    "Create one complete hyper-realistic photographic character reference sheet, not a poster.",
    "Use a strict 3x3 grid layout containing 9 separate, highly consistent, unretouched DSLR photographic panels on a single clean, solid off-white studio sheet.",
    "Every panel must feature the exact same character described by the user prompt, with identical face, hair, skin tone, outfit, accessories, body proportions, age impression, and identity across all views.",
    "The character must look like a real person photographed in a professional studio, not CGI, not illustration, not a beauty render, not a digital avatar.",
    "Row 1, panels 1-3: strict close-up headshots. Panel 1 is a straight-on frontal face detail. Panel 2 is a left three-quarter face detail. Panel 3 is a full side profile face detail.",
    "Row 1 must emphasize high-resolution photographic skin texture: visible pores, natural facial asymmetry, subtle moles or tiny skin variations where natural, fine lines around the eyes, natural under-eye shadows, and slight realistic skin sheen.",
    "Row 2, panels 4-6: medium waist-up portraits. Panel 4 is a straight-on frontal medium shot. Panel 5 is a right three-quarter medium shot. Panel 6 is a full side profile medium shot.",
    "Row 2 must show the full hairstyle, outfit silhouette, accessories, shoulders, torso shape, and consistent upper-body proportions.",
    "Row 3, panels 7-9: full-body and alternative angles. Panel 7 is crucial: a perfectly symmetrical straight-on frontal full-body standing shot, arms resting naturally at the sides, head facing directly forward, with identical facial features and body proportions sharp and proportional from head to toe.",
    "Panel 8 is a left three-quarter full-body standing shot. Panel 9 is a straight back view showing the full back silhouette, hairstyle, outfit back, and fit posture.",
    "Use consistent clean overhead softbox studio lighting across all 9 panels, with realistic natural shadows that define face and body structure without washing out detail.",
    "Use sharp full-frame DSLR photography, 85mm portrait lens feel, approximately f/4 depth of field, natural perspective, no facial distortion, true-to-life skin tones, realistic fabric creasing, sharp facial detail, clean reference-sheet layout, and high identity consistency.",
    "Do not add text, labels, captions, numbers, logos, watermarks, social handles, icons, UI elements, grid lines, borders, or decorative graphics.",
    "No extra people, no duplicate identities, no distorted hands, no cartoon style, no anime, no CGI elements, no 3D render, no plastic skin, no doll-like face, no airbrushed skin, no digital smoothing, no exaggerated eyes."
  ].join(", ");
}

function buildCharacterSheetVariantPrompt(imagePrompt, variantIndex, totalVariants) {
  return [
    imagePrompt,
    `This is character sheet option ${variantIndex} of ${totalVariants}.`,
    "Create a distinct casting option from the same user brief, while preserving the requested age range, ethnicity or cultural identity, outfit direction, body type, and reference-sheet structure.",
    "Do not copy the exact facial identity from the other options. Vary subtle real-person casting details such as face shape nuance, expression, hairstyle micro-details, and natural skin marks while staying faithful to the user's prompt.",
    "The 9 panels inside this single sheet must still be the exact same person with perfect identity consistency."
  ].join(" ");
}

async function callGeminiText({
  instruction,
  prompt,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  temperature = 0.7
}) {
  if (!apiKey) {
    throw new Error("Set GEMINI_API_KEY in .env to use guided prompt questions");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: instruction ? { parts: [{ text: instruction }] } : undefined,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        topP: 0.95,
        responseMimeType: "application/json"
      }
    })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Gemini prompt direction failed: ${response.status} ${response.statusText} ${body ? JSON.stringify(body) : ""}`);
  }

  const text = (body?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n").trim();
  if (!text) {
    throw new Error("Gemini prompt direction returned empty output");
  }
  return text;
}

function parseJsonObject(text) {
  const clean = String(text || "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function summarizeCharacterForPrompt(character) {
  return {
    id: character.id,
    display_name: character.display_name,
    persona: character.persona || "",
    visual_identity: character.visual_identity || {},
    reference_image_count: character.reference_images?.length || 0,
    source_status: character.source_status || ""
  };
}

function fallbackDirectorQuestions() {
  return [
    { id: "location", question: "Where exactly is the influencer standing or moving?", hint: "Example: Marine Drive at sunset, luxury cafe, studio, airport lounge." },
    { id: "emotion", question: "What should the viewer feel by the end of the 10 seconds?", hint: "Aspirational, intimate, energetic, mysterious, premium, emotional." },
    { id: "message", question: "What is the one core message or line the influencer must communicate?", hint: "Keep it short enough for 10 seconds." },
    { id: "dialogue", question: "Should the influencer speak? If yes, what exact words or style of dialogue?", hint: "Exact lines, Hindi/English mix, no speech, or natural VO." },
    { id: "action", question: "What physical action should happen on screen?", hint: "Walking toward camera, looking at sea, adjusting jacket, smiling, turning." },
    { id: "camera", question: "What camera feel do you want?", hint: "Handheld, locked-off, slow push-in, side pan, rack focus, close-up heavy." },
    { id: "shots", question: "Which shot types are allowed or forbidden?", hint: "Medium close-up only, no wide shots, face always sharp." },
    { id: "lighting", question: "What lighting and color grade should it have?", hint: "Golden hour, neon night, soft studio, warm cinematic, cool editorial." },
    { id: "environment_audio", question: "What ambience or audio should be present?", hint: "Sea waves, cafe ambience, traffic, clean dialogue, no music." },
    { id: "avoid", question: "What should the model avoid at all costs?", hint: "Extra people, logos, face blur, subtitles, jump cuts, distorted hands." }
  ];
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
  const headers = { "Content-Type": contentType(ext) };
  if (pathname.startsWith("/generated-characters/")) {
    headers["Cache-Control"] = "no-store";
  }
  res.writeHead(200, headers);
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
