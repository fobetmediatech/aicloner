# Influencer Visual Pipeline

This branch keeps the AI influencer visual work separate from the existing
Module 1 Kling clip generator and from the later voice-cloning integration.

## Purpose

The pipeline creates a repeatable visual kit for one synthetic influencer:

1. Define the influencer persona and visual identity.
2. Generate a multi-angle reference-shot prompt plan.
3. Write a character draft into the existing character registry shape.
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
