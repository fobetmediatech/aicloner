export function planClips({ prompt, desiredDurationSeconds, clipDurationLimitSeconds }) {
  const clipCount = Math.ceil(desiredDurationSeconds / clipDurationLimitSeconds);
  const clips = [];

  for (let index = 0; index < clipCount; index += 1) {
    const remaining = desiredDurationSeconds - index * clipDurationLimitSeconds;
    const duration = Math.min(clipDurationLimitSeconds, remaining);
    clips.push({
      index: index + 1,
      id: `clip_${String(index + 1).padStart(3, "0")}`,
      duration_seconds: duration,
      source_prompt: prompt,
      continuity_mode: index === 0 ? "initial" : "continue_from_previous_end_frame"
    });
  }

  return clips;
}
