import { planClips } from "./planner.js";
import { buildDirectorPrompt } from "./director.js";
import { buildOmniVideoPayload } from "./kling/payload.js";
import { KlingClient } from "./kling/client.js";
import { createRunStore } from "./store.js";
import { resolveCharacter } from "./characters/registry.js";

export async function runModule1(config) {
  const character = await resolveCharacter(config);

  const store = await createRunStore({
    outputDir: config.output_dir,
    runName: config.run_name
  });

  const clips = planClips({
    prompt: config.video.prompt,
    desiredDurationSeconds: config.video.desired_duration_seconds,
    clipDurationLimitSeconds: config.video.clip_duration_limit_seconds
  });

  if (!config.dry_run && clips.length > 1 && !config.kling.task_status_path_template) {
    throw new Error("Live multi-clip generation requires a verified Kling polling/download flow before continuation clips can be generated.");
  }

  const manifest = {
    run_id: store.runId,
    module: "module1",
    provider: "kling",
    status: "running",
    dry_run: Boolean(config.dry_run),
    character_id: character.id,
    desired_duration_seconds: config.video.desired_duration_seconds,
    clip_duration_limit_seconds: config.video.clip_duration_limit_seconds,
    output_dir: store.dirs.root,
    clips: []
  };

  await store.writeJson("manifest.json", manifest);

  const kling = new KlingClient({
    baseUrl: config.kling.base_url,
    taskStatusPathTemplate: config.kling.task_status_path_template
  });

  let previousEndFrameUrl = null;

  for (const clip of clips) {
    const directorPrompt = buildDirectorPrompt({
      clip,
      totalClips: clips.length,
      character,
      video: config.video,
      director: config.director
    });

    const request = buildOmniVideoPayload({
      modelName: config.kling.model_name,
      prompt: directorPrompt,
      character,
      clip,
      video: config.video,
      previousEndFrameUrl
    });

    await store.writeRequest(clip.id, request);

    const clipRecord = {
      ...clip,
      prompt: directorPrompt,
      request_file: `requests/${clip.id}.request.json`,
      status: "planned"
    };

    if (config.dry_run) {
      clipRecord.status = "dry_run_planned";
      clipRecord.output_video = `clips/${clip.id}.mp4`;
      clipRecord.end_frame = `frames/${clip.id}_end.png`;
      previousEndFrameUrl = buildPublishedAssetUrl({
        publicBaseUrl: config.storage?.public_base_url,
        runId: store.runId,
        relativePath: clipRecord.end_frame
      });
    } else {
      const response = await kling.createOmniVideo(request);
      await store.writeResponse(clip.id, response);
      clipRecord.status = "submitted";
      clipRecord.response_file = `responses/${clip.id}.response.json`;
      clipRecord.kling_response = summarizeKlingResponse(response);
    }

    manifest.clips.push(clipRecord);
    await store.writeJson("manifest.json", manifest);
  }

  manifest.status = config.dry_run ? "dry_run_complete" : "submitted";
  await store.writeJson("manifest.json", manifest);

  return {
    status: manifest.status,
    run_id: store.runId,
    output_dir: store.dirs.root,
    clip_count: clips.length,
    manifest: `${store.dirs.root}/manifest.json`
  };
}

function summarizeKlingResponse(response) {
  if (!response || typeof response !== "object") return response;
  return {
    task_id: response.task_id || response.id || response.data?.task_id || response.data?.id || null,
    status: response.status || response.data?.status || null,
    raw_shape: Object.keys(response)
  };
}

function buildPublishedAssetUrl({ publicBaseUrl, runId, relativePath }) {
  if (!publicBaseUrl) return null;
  return `${publicBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(runId)}/${relativePath}`;
}
