# Kling API Notes For Module 1

Sources checked:

- Official Kling Omni Video API: https://kling.ai/document-api/apiReference%2Fmodel%2FOmniVideo
- Official Kling product/API docs root: https://kling.ai/document-api/quickStart/productIntroduction/overview
- Kling custom voices API page: https://kling.ai/document-api/apiReference%2Fmodel%2FcustomVoices

## Confirmed For V1

### Omni Video Create

Official endpoint:

```http
POST https://api-singapore.klingai.com/v1/videos/omni-video
Authorization: Bearer <token>
Content-Type: application/json
```

Important request fields:

- `model_name`: examples show `kling-video-o1`
- `prompt`: prompt with optional placeholders like `<<<image_1>>>`, `<<<element_1>>>`, `<<<video_1>>>`
- `image_list`: reference images and first/end frames
- `element_list`: reusable elements by `element_id`
- `video_list`: reference video clips, including next-shot style extension
- `mode`: examples show `pro`
- `aspect_ratio`: examples include `1:1`
- `duration`: official FAQ says optional `3-10s` for common O1 text/image/reference cases

Start/end frame examples use:

```json
{
  "image_list": [
    { "image_url": "https://...", "type": "first_frame" },
    { "image_url": "https://...", "type": "end_frame" }
  ]
}
```

Video reference extension is documented as the way to generate the next shot:

```json
{
  "video_list": [
    {
      "video_url": "https://...",
      "refer_type": "feature",
      "keep_original_sound": "yes"
    }
  ]
}
```

## Must Verify With Account

### Task Polling

The public Omni page shows asynchronous generation behavior, but the exact
official global status endpoint was not clearly visible in public docs during
research. This project leaves polling configurable via:

```text
KLING_TASK_STATUS_PATH_TEMPLATE=/v1/tasks/{task_id}
```

Do not assume that path is valid until verified with the account.

### Reusable Character / Element Creation

Omni generation accepts `element_list` with `element_id`, which is the right
shape for persistent characters. Public search results and third-party docs
refer to custom element creation, but the exact official endpoint must be
verified before implementation.

V1 fallback:

- Keep the canonical character registry in our app.
- Store 30 source images internally.
- If no Kling element API is available, select 3-4 reference images per clip
  and pass them through `image_list`.

### Custom Voice

Kling has a custom voices API reference page, but Module 1 should not depend on
Kling voice cloning for V1. Voice generation/lip-sync belongs to Module 3.

## V1 Implementation Rule

Use Kling only for visual clip generation.

Generate one clip per request, then use the previous clip's extracted end frame
as the next request's `first_frame` where the API accepts it.

That frame must be accessible to Kling as a URL. Local paths are only useful
inside the manifest. Production needs an object-storage upload step before
requesting clip 2+.
