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
    assertKlingFetchableUrl(previousEndFrameUrl, "previous end frame");
    imageList.push({
      image_url: previousEndFrameUrl,
      type: "first_frame"
    });
  } else {
    for (const imageUrl of character.reference_images.slice(0, 4)) {
      assertKlingFetchableUrl(imageUrl, "reference image");
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

  if (character.kling_element_id && video.use_element_list !== false) {
    payload.element_list = [{ element_id: character.kling_element_id }];
  }

  return payload;
}

function assertKlingFetchableUrl(value, label) {
  const url = String(value || "");
  if (!/^https?:\/\//.test(url)) {
    throw new Error(`Kling requires ${label} to be an externally fetchable http(s) URL. Got: ${url || "empty"}`);
  }
}
