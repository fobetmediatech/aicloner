export function buildOmniVideoPayload({
  modelName,
  prompt,
  character,
  clip,
  video,
  previousEndFrameUrl
}) {
  const imageList = [];

  if (previousEndFrameUrl) {
    imageList.push({
      image_url: previousEndFrameUrl,
      type: "first_frame"
    });
  } else {
    for (const imageUrl of character.reference_images.slice(0, 4)) {
      imageList.push({ image_url: imageUrl });
    }
  }

  const payload = {
    model_name: modelName,
    prompt,
    mode: video.mode || "pro",
    aspect_ratio: video.aspect_ratio || "16:9",
    duration: String(clip.duration_seconds)
  };

  if (imageList.length) {
    payload.image_list = imageList;
  }

  if (character.kling_element_id) {
    payload.element_list = [{ element_id: character.kling_element_id }];
  }

  return payload;
}
