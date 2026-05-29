# AI Clone Pipeline

This repo currently contains Module 1: a sequential Kling clip generator.

Module 1 does not try to generate a full video in one model call. It plans
10-15 second clips, generates them sequentially, extracts the final frame from
each clip, and feeds that frame into the next generation as the first frame.

## Quick Start

Dry-run the Module 1 planner without calling Kling:

```bash
npm run module1:dry-run
```

Run against Kling after setting `KLING_API_TOKEN`:

```bash
cp .env.example .env
npm run module1:run
```

The live run currently submits Kling Omni Video generation requests and writes
request/response manifests. Task polling and reusable character creation are
left as verified API spike points because the public Kling docs clearly expose
Omni generation, but account-specific task/status and element-management
surfaces must be confirmed.

## Output

Each run writes to `output/module1/<run_id>/`:

- `manifest.json`: full run state
- `requests/clip_XXX.request.json`: exact Kling payloads
- `responses/clip_XXX.response.json`: Kling responses for live calls
- `frames/clip_XXX_end.png`: extracted end frames when video files exist
- `clips/clip_XXX.mp4`: downloaded/generated clip location when available

Continuation clips require a URL that Kling can fetch. In production, extracted
end frames must be uploaded to object storage and exposed through a signed or
public URL before they are used as the next clip's `first_frame`.

## Relevant Design Doc

The approved planning doc is stored at:

`/home/dawn/.gstack/projects/ai_clone/dawn-unknown-design-20260528-142600.md`

## Character Registry

Characters live in `data/characters/<character_id>.json`. Module 1 configs can
select an existing character with `character_id`, or inline a `character` object
for quick API spikes.

Provider-specific IDs such as `kling_element_id` and `kling_voice_id` should be
stored on the character once the corresponding Kling APIs are verified.

## Local MySQL

A MySQL schema is included for the real character/run store:

```bash
npm run db:up
```

Schema file: `schema/schema.sql`.

The current UI still writes demo character metadata to `data/characters/` and
uploaded files to `uploads/characters/` so development can continue without a
Kling key or DB driver. The schema is ready for the later persistence adapter.
