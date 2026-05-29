export function buildDirectorPrompt({ clip, totalClips, character, video, director }) {
  const phase = describeClipPhase(clip.index, totalClips);
  const continuity = clip.index === 1
    ? "Start with the selected character already framed clearly."
    : "Continue naturally from the supplied first frame. Do not reset the scene.";

  return [
    `Clip ${clip.index} of ${totalClips}.`,
    `User intent: ${video.prompt}`,
    `Narrative phase: ${phase}.`,
    `Character: ${character.display_name || character.id}. Preserve identity and facial consistency.`,
    `Style: ${director?.style || "stable, realistic, natural motion"}.`,
    continuity,
    `Duration: ${clip.duration_seconds} seconds.`,
    `Avoid: ${director?.negative_instructions || "identity drift, extra people, distorted face, distorted hands"}.`
  ].join(" ");
}

function describeClipPhase(index, total) {
  if (total === 1) return "complete the full idea in one concise clip";
  if (index === 1) return "opening setup";
  if (index === total) return "closing continuation and clean ending";
  return "middle continuation";
}
