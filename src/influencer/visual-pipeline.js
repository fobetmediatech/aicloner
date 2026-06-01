import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ANGLES = [
  {
    id: "front_portrait",
    label: "Front portrait",
    prompt: "front-facing chest-up portrait, direct eye contact, neutral friendly expression"
  },
  {
    id: "three_quarter_left",
    label: "Three-quarter left",
    prompt: "three-quarter left angle portrait, face turned slightly toward camera"
  },
  {
    id: "three_quarter_right",
    label: "Three-quarter right",
    prompt: "three-quarter right angle portrait, natural relaxed pose"
  },
  {
    id: "side_profile",
    label: "Side profile",
    prompt: "clean side profile portrait, visible facial silhouette and hair shape"
  },
  {
    id: "full_body",
    label: "Full body",
    prompt: "full-body fashion creator shot, standing naturally, complete outfit visible"
  },
  {
    id: "close_up_expression",
    label: "Close-up expression",
    prompt: "tight close-up portrait, subtle smile, expressive eyes, high identity detail"
  }
];

export async function loadInfluencerVisualConfig(configPath) {
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw);
  validateInfluencerVisualConfig(config);
  return config;
}

export async function runInfluencerVisualPlan(config) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(config.run_name)}`;
  const runDir = path.join(config.output_dir, runId);
  await mkdir(runDir, { recursive: true });

  const prompts = buildReferenceShotPrompts(config);
  const videoPrompts = buildVideoPrompts(config);
  const character = buildCharacterDraft(config, prompts);
  const manifest = {
    run_id: runId,
    module: "influencer_visual_pipeline",
    status: "planned",
    output_dir: runDir,
    character_id: character.id,
    character_file: path.join(config.character_registry_dir, `${character.id}.json`),
    next_steps: [
      "Generate the planned reference images with your chosen image model.",
      "Add externally fetchable image URLs to the character reference_images array.",
      "Create or attach a Kling element ID after the account-specific element API is verified.",
      "Use the character in Module 1 for silent visual clip generation before voice integration."
    ],
    prompts,
    video_prompts: videoPrompts
  };

  await writeJson(path.join(runDir, "manifest.json"), manifest);
  await writeJson(path.join(runDir, "reference-shot-prompts.json"), prompts);
  await writeJson(path.join(runDir, "video-prompts.json"), videoPrompts);
  await writeJson(path.join(runDir, "character-draft.json"), character);

  if (config.write_character_registry !== false) {
    await mkdir(config.character_registry_dir, { recursive: true });
    await writeJson(path.join(config.character_registry_dir, `${character.id}.json`), character);
  }

  return {
    status: manifest.status,
    run_id: runId,
    output_dir: runDir,
    character_id: character.id,
    reference_prompt_count: prompts.length,
    video_prompt_count: videoPrompts.length,
    manifest: path.join(runDir, "manifest.json")
  };
}

export function buildReferenceShotPrompts(config) {
  const character = config.character;
  const identity = character.visual_identity || {};
  const shots = config.shots || {};
  const angles = Array.isArray(shots.angles) && shots.angles.length ? shots.angles : DEFAULT_ANGLES;
  const identityText = [
    character.persona,
    identity.age_range,
    identity.presentation,
    identity.face,
    identity.hair,
    identity.wardrobe,
    identity.brand_style
  ].filter(Boolean).join(", ");

  return angles.map((angle, index) => ({
    id: angle.id || `shot_${String(index + 1).padStart(2, "0")}`,
    label: angle.label || `Reference shot ${index + 1}`,
    aspect_ratio: shots.aspect_ratio || "9:16",
    prompt: [
      `Create a consistent AI influencer reference image.`,
      `Identity: ${identityText}.`,
      `Shot: ${angle.prompt || angle.description || angle.label}.`,
      `Background: ${shots.background || "plain studio background"}.`,
      `Lighting: ${shots.lighting || "soft natural lighting"}.`,
      `Camera: ${shots.camera || "realistic portrait photography"}.`,
      `Keep the same face, hair, body proportions, and styling across every reference shot.`,
      `Avoid: ${shots.negative_instructions || "identity drift, distorted anatomy, text, watermark"}.`
    ].join(" ")
  }));
}

export function buildVideoPrompts(config) {
  const videoPrompts = config.video_prompts || {};
  const defaults = videoPrompts.defaults || {};
  const scenes = Array.isArray(videoPrompts.scenes) ? videoPrompts.scenes : [];
  const character = config.character;
  const identity = character.visual_identity || {};
  const identityText = [
    character.display_name,
    character.persona,
    identity.age_range,
    identity.presentation,
    identity.face,
    identity.hair,
    identity.wardrobe,
    identity.brand_style
  ].filter(Boolean).join(", ");

  return scenes.map((scene, index) => {
    const shots = normalizeTimedItems(scene.shots, "Shot");
    const dialogue = normalizeTimedItems(scene.dialogue, "Dialogue");
    const prompt = [
      `${scene.duration_seconds || defaults.duration_seconds || 10} second cinematic video.`,
      `Character identity: ${identityText}.`,
      `Scene: ${scene.location || scene.title || scene.id}.`,
      `Mood: ${scene.mood || "cinematic, natural, premium social video"}.`,
      `Visual rules: ${defaults.style || "medium to close-up shots only, face always clear and sharp"}.`,
      `Continuity: ${defaults.continuity || "preserve the same face, hair, wardrobe, and body proportions in every shot"}.`,
      `Multi-shot breakdown: ${formatShotBreakdown(shots)}.`,
      `Camera motion per shot: ${formatCameraMotion(shots)}.`,
      dialogue.length ? `Dialogue timing: ${formatDialogue(dialogue)}.` : "",
      `Audio: ${scene.audio || defaults.audio || "clean natural ambience, no music"}.`,
      `Avoid: ${scene.negative_instructions || defaults.negative_instructions || "wide shots, face blur, identity drift, distorted anatomy, text overlays"}.`
    ].filter(Boolean).join(" ");

    return {
      id: scene.id || `video_prompt_${String(index + 1).padStart(2, "0")}`,
      title: scene.title || scene.id || `Video prompt ${index + 1}`,
      duration_seconds: scene.duration_seconds || defaults.duration_seconds || 10,
      aspect_ratio: scene.aspect_ratio || config.shots?.aspect_ratio || "9:16",
      prompt,
      shots,
      dialogue,
      audio: scene.audio || defaults.audio || "clean natural ambience, no music"
    };
  });
}

function buildCharacterDraft(config, prompts) {
  const source = config.character;
  return {
    id: source.id,
    display_name: source.display_name,
    consent_status: source.consent_status || "synthetic-character",
    source_status: "visual_reference_planned",
    persona: source.persona || "",
    visual_identity: source.visual_identity || {},
    kling_element_id: source.kling_element_id || null,
    kling_voice_id: source.kling_voice_id || null,
    reference_images: Array.isArray(source.reference_images) ? source.reference_images : [],
    planned_reference_shots: prompts.map(({ id, label, aspect_ratio }) => ({ id, label, aspect_ratio })),
    notes: "Generated by the influencer visual pipeline. Add generated image URLs before live Kling video generation."
  };
}

function normalizeTimedItems(items, label) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    time: item.time || `${index}-${index + 1}s`,
    label: item.label || `${label} ${index + 1}`,
    framing: item.framing || item.description || "",
    camera_motion: item.camera_motion || "",
    line: item.line || ""
  }));
}

function formatShotBreakdown(shots) {
  return shots
    .map((shot) => `${shot.time} - ${shot.framing}`)
    .join("; ");
}

function formatCameraMotion(shots) {
  return shots
    .map((shot, index) => `Shot ${index + 1} - ${shot.camera_motion || "natural stable camera movement"}`)
    .join("; ");
}

function formatDialogue(dialogue) {
  return dialogue
    .map((item) => `${item.time} - "${item.line}"`)
    .join("; ");
}

function validateInfluencerVisualConfig(config) {
  const missing = [
    ["run_name", config.run_name],
    ["output_dir", config.output_dir],
    ["character_registry_dir", config.character_registry_dir],
    ["character.id", config.character?.id],
    ["character.display_name", config.character?.display_name]
  ].filter(([, value]) => value === undefined || value === null || value === "").map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing influencer visual config fields: ${missing.join(", ")}`);
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
