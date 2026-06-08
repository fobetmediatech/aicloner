# AI Clone / Influencer Pipeline Guidance

This file captures the local working rules for AI-assisted development on this repo. It is inspired by gstack-style workflow discipline, but does not install or depend on gstack.

## Branch Safety

- Work on the `bhavish` branch unless the user explicitly says otherwise.
- Do not modify, reset, or push to `main`.
- Do not revert changes you did not make.
- Do not commit `.env` or secrets.
- Do not blindly stage generated test artifacts. Only commit generated assets when they are intentionally needed for a public URL or a reproducible demo.

## Current Stack

- Frontend: vanilla HTML, CSS, and JavaScript in `public/influencer.html`, `public/influencer-styles.css`, and `public/influencer-app.js`.
- Backend: Node.js built-in HTTP server in `src/server/dev-server.js`.
- Pipeline logic: `src/influencer/visual-pipeline.js`, `src/module1/*`, and provider-specific helpers.
- Database schema exists in `schema/schema.sql`, but the current local studio flow primarily uses JSON files and filesystem assets.

## Provider Roles

- Gemini: character sheet generation and cinematic prompt expansion.
- Kling: video generation and video task polling.
- ElevenLabs: upcoming voice/audio generation.
- fal.ai or another sync provider: future lip-sync/final merge step.
- ADK: possible future orchestration layer after the direct pipeline is stable.

## Pipeline Shape

1. Generate or select an influencer character.
2. Generate multiple character sheet references.
3. Select the best reference sheet.
4. Publish the selected sheet to a public HTTPS URL when Kling needs it.
5. Ask director questions and build a detailed cinematic prompt.
6. Generate Kling video and poll until video URL is available.
7. Generate matching voice audio with ElevenLabs.
8. Later: merge/lip-sync video and audio.

## Implementation Rules

- Follow existing file organization and state style before adding new abstractions.
- Keep UI changes consistent with the current premium influencer studio design.
- Prefer direct REST API calls for external providers unless the repo already uses an SDK.
- Keep video and audio URLs available at top-level pipeline state for the future sync step.
- Add comments only where they explain non-obvious pipeline decisions.

## Validation Checklist

- Run `cmd.exe /c npm run check` after JavaScript changes.
- Restart the local server after backend changes.
- Test the UI at `http://127.0.0.1:5173/influencer.html`.
- Before pushing, inspect `git status --short` and stage only essential files.
