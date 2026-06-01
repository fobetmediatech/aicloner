# Influencer Visual Pipeline

This branch keeps the AI influencer visual work separate from the existing
Module 1 Kling clip generator and from the later voice-cloning integration.

## Purpose

The pipeline creates a repeatable visual kit for one synthetic influencer:

1. Generate a base character image through Kling image generation.
2. Generate multi-angle reference shots through Kling AI Multi-Shot.
3. Write the generated character into the existing character registry shape.
4. Use the generated reference images, or a verified Kling element ID, in
   Module 1 for silent visual clip generation.

## Run

```bash
npm run influencer:plan
```

The demo config is:

```text
configs/influencer.visual.demo.json
```

Each run writes:

- `manifest.json`
- `reference-shot-prompts.json`
- `video-prompts.json`
- `character-draft.json`

The default config also writes:

```text
data/characters/demo-ai-influencer.json
```

## Current Boundary

This module does not clone a real person and does not generate voice. Voice and
lip sync should stay in the later integration branch. The current output is a
clean visual planning layer that can feed image generation and then Module 1.

Kling element creation is intentionally not hardcoded yet because the official
account-specific element-management endpoint still needs to be verified.

## Video Prompt Quality

Video prompts are structured as cinematic shot plans, not loose one-line
prompts. Each scene can define duration, location, mood, shot timing, framing,
camera motion, dialogue timing, ambience, and negative instructions.

The generated `video-prompts.json` includes a flattened prompt string that can
be pasted directly into Kling or passed into Module 1 after reference images or
a verified element ID are ready.

## Step 0

The Influencer Studio page adds a Kling-first character generation step:

1. User enters a character name and basic character prompt.
2. Backend submits a Kling image generation task for the frontal/base image.
3. Backend submits Kling AI Multi-Shot using that base image.
4. Returned image URLs are saved to `data/characters/<character_id>.json`.
5. The UI auto-selects that character for video prompt and video generation.

The AI Multi-Shot endpoint is fixed at `/v1/general/ai-multi-shot`. The
text-to-image endpoint is configurable because account/model availability may
vary:

```text
KLING_IMAGE_MODEL=kling-v2-1
KLING_IMAGE_CREATE_PATH=/v1/images/generations
KLING_IMAGE_STATUS_PATH_TEMPLATE=/v1/images/generations/{task_id}
```
