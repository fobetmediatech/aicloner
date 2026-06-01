const state = {
  characters: [],
  runs: [],
  selectedCharacterId: null
};

const el = {
  refreshButton: document.querySelector("#refreshButton"),
  refreshRuns: document.querySelector("#refreshRuns"),
  selectMode: document.querySelector("#selectMode"),
  createMode: document.querySelector("#createMode"),
  selectCharacterView: document.querySelector("#selectCharacterView"),
  createCharacterForm: document.querySelector("#createCharacterForm"),
  characterSelect: document.querySelector("#characterSelect"),
  characterDetails: document.querySelector("#characterDetails"),
  runForm: document.querySelector("#runForm"),
  clearResult: document.querySelector("#clearResult"),
  resultSummary: document.querySelector("#resultSummary"),
  clipList: document.querySelector("#clipList"),
  runList: document.querySelector("#runList"),
  statusPill: document.querySelector("#statusPill"),
  geminiPromptReview: document.querySelector("#geminiPromptReview"),
  generateVideoButton: document.querySelector("#generateVideoButton"),
  generateVideoStatus: document.querySelector("#generateVideoStatus"),
  generatedVideo: document.querySelector("#generatedVideo"),
  videoPlaceholder: document.querySelector("#videoPlaceholder")
};

el.refreshButton.addEventListener("click", refreshAll);
el.refreshRuns.addEventListener("click", loadRuns);
el.selectMode.addEventListener("click", () => setCharacterMode("select"));
el.createMode.addEventListener("click", () => setCharacterMode("create"));
el.characterSelect.addEventListener("change", () => {
  state.selectedCharacterId = el.characterSelect.value;
  renderCharacterDetails();
});
el.createCharacterForm.addEventListener("submit", createCharacter);
el.runForm.addEventListener("submit", runDryPlan);
el.clearResult.addEventListener("click", clearResult);
el.generateVideoButton.addEventListener("click", generateVideo);

refreshAll();

async function refreshAll() {
  await Promise.all([loadCharacters(), loadRuns()]);
}

async function loadCharacters() {
  state.characters = await api("/api/characters");
  if (!state.selectedCharacterId && state.characters[0]) {
    state.selectedCharacterId = state.characters[0].id;
  }
  renderCharacters();
}

async function loadRuns() {
  state.runs = await api("/api/runs");
  renderRuns();
}

function renderCharacters() {
  el.characterSelect.innerHTML = state.characters.map((character) => (
    `<option value="${escapeHtml(character.id)}">${escapeHtml(character.display_name || character.id)}</option>`
  )).join("");

  if (state.selectedCharacterId) el.characterSelect.value = state.selectedCharacterId;
  if (!state.characters.length) el.characterSelect.innerHTML = `<option value="">No characters</option>`;
  renderCharacterDetails();
}

function renderCharacterDetails() {
  const character = selectedCharacter();
  if (!character) {
    el.characterDetails.innerHTML = `<div><dt>Status</dt><dd>Create a character first</dd></div>`;
    return;
  }

  el.characterDetails.innerHTML = details({
    ID: character.id,
    Consent: character.consent_status || "pending",
    Images: String(character.reference_images?.length || character.asset_counts?.reference_images || 0),
    Voice: character.voice_sample ? "uploaded" : "missing",
    "Provider status": character.kling_element_id ? "Kling character ready" : "pending Kling API"
  });
}

async function createCharacter(event) {
  event.preventDefault();
  setCreateBusy(true);
  try {
    const voiceFile = document.querySelector("#newVoiceSample").files[0];
    const imageFiles = Array.from(document.querySelector("#newCharacterImages").files);
    const payload = {
      display_name: value("#newCharacterName"),
      voice_sample: voiceFile ? await fileToData(voiceFile) : null,
      images: await Promise.all(imageFiles.map(fileToData))
    };

    const character = await api("/api/characters", { method: "POST", body: payload });
    state.selectedCharacterId = character.id;
    el.createCharacterForm.reset();
    setCharacterMode("select");
    await loadCharacters();
  } catch (error) {
    showError(error.message);
  } finally {
    setCreateBusy(false);
  }
}


async function generateVideo() {
  const character = selectedCharacter();
  if (!character) return showError("Create or select a character first.");
  const prompt = el.geminiPromptReview.value.trim();
  if (!prompt) return showError("Generate or enter a Gemini video prompt first.");

  el.generateVideoButton.disabled = true;
  el.generateVideoStatus.textContent = "Submitting to Kling...";
  try {
    const result = await api("/api/module1/generate-video", {
      method: "POST",
      body: {
        character_id: character.id,
        prompt,
        aspect_ratio: value("#aspectRatio")
      }
    });
    el.generatedVideo.src = result.video_url;
    el.generatedVideo.load();
    el.videoPlaceholder.classList.add("hidden");
    el.generateVideoStatus.textContent = result.downloaded_path ? `Video ready · saved to ${result.downloaded_path}` : "Video ready";
  } catch (error) {
    el.generateVideoStatus.textContent = error.message;
  } finally {
    el.generateVideoButton.disabled = false;
  }
}

async function runDryPlan(event) {
  event.preventDefault();
  const character = selectedCharacter();
  if (!character) return showError("Create or select a character first.");

  setRunBusy(true);
  try {
    const result = await api("/api/module1/dry-run", {
      method: "POST",
      body: {
        character_id: character.id,
        prompt: value("#prompt"),
        desired_duration_seconds: 10,
        clip_duration_limit_seconds: 10,
        aspect_ratio: value("#aspectRatio"),
        mode: "pro"
      }
    });
    const manifest = await api(`/api/runs/${encodeURIComponent(result.run_id)}/manifest`);
    renderManifest(manifest);
    await loadRuns();
  } catch (error) {
    showError(error.message);
  } finally {
    setRunBusy(false);
  }
}

function renderManifest(manifest) {
  const ok = manifest.status === "dry_run_complete" || manifest.status === "submitted" || manifest.status === "complete";
  el.statusPill.textContent = ok ? "OK" : "Not OK";
  el.statusPill.classList.toggle("statusOk", ok);
  el.statusPill.classList.toggle("statusBad", !ok);
  el.resultSummary.className = "runPath";
  el.resultSummary.textContent = manifest.output_dir;
  el.geminiPromptReview.value = manifest.gemini_rewrite?.output_prompt || manifest.clips[0]?.source_prompt || "";
  el.clipList.innerHTML = manifest.clips.map((clip) => clipCard(clip, manifest)).join("");
  el.clipList.querySelectorAll(".clipItem").forEach((card) => {
    card.addEventListener("click", () => card.classList.toggle("expanded"));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.classList.toggle("expanded");
      }
    });
  });
}

function clipCard(clip, manifest) {
  const title = `${clip.index}/${manifest.clips.length}`;
  return `
    <article class="clipItem" tabindex="0">
      <div class="clipTop">
        <div>
          <div class="clipTitle">${escapeHtml(title)}</div>
          <div class="clipMeta">Click to inspect details</div>
        </div>
      </div>
      <div class="detailLabel inlineLabel">Gemini output</div>
      <div class="clipPrompt">${escapeHtml(clip.source_prompt || "")}</div>
      <div class="clipDetails">
        <div class="detailBlock simplePrompt">
          <p>${escapeHtml(clip.source_prompt || "")}</p>
        </div>
      </div>
    </article>
  `;
}


function renderRuns() {
  if (!state.runs.length) {
    el.runList.innerHTML = `<div class="emptyState">No runs yet</div>`;
    return;
  }

  el.runList.innerHTML = state.runs.slice(0, 8).map((run) => `
    <button class="runItem" type="button" data-run-id="${escapeHtml(run.run_id)}">
      <div class="runTop">
        <span class="runTitle">${escapeHtml(run.run_id)}</span>
        <span class="runMeta">${escapeHtml(run.status)}</span>
      </div>
      <div class="runMeta">${escapeHtml(run.character_id)} · ${run.clip_count} clips</div>
    </button>
  `).join("");

  el.runList.querySelectorAll("[data-run-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const manifest = await api(`/api/runs/${encodeURIComponent(button.dataset.runId)}/manifest`);
      renderManifest(manifest);
    });
  });
}

function setCharacterMode(mode) {
  const create = mode === "create";
  el.createCharacterForm.classList.toggle("hidden", !create);
  el.selectCharacterView.classList.toggle("hidden", create);
  el.createMode.classList.toggle("active", create);
  el.selectMode.classList.toggle("active", !create);
}

function clearResult() {
  el.statusPill.textContent = "No run";
  el.statusPill.classList.remove("statusOk", "statusBad");
  el.resultSummary.className = "emptyState";
  el.resultSummary.textContent = "Generate a clip plan to create the Module 1 manifest.";
  el.clipList.innerHTML = "";
  el.geminiPromptReview.value = "";
  el.generateVideoStatus.textContent = "Placeholder until Kling API is connected";
}

function selectedCharacter() {
  return state.characters.find((character) => character.id === state.selectedCharacterId) || null;
}

function setRunBusy(isBusy) {
  el.runForm.querySelectorAll("button, input, textarea, select").forEach((node) => { node.disabled = isBusy; });
  el.statusPill.textContent = isBusy ? "Planning" : el.statusPill.textContent;
}

function setCreateBusy(isBusy) {
  el.createCharacterForm.querySelectorAll("button, input").forEach((node) => { node.disabled = isBusy; });
}

function showError(message) {
  el.statusPill.textContent = "Not OK";
  el.statusPill.classList.remove("statusOk");
  el.statusPill.classList.add("statusBad");
  el.resultSummary.className = "emptyState";
  el.resultSummary.textContent = message;
  el.clipList.innerHTML = "";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function fileToData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data_url: reader.result });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function details(values) {
  return Object.entries(values).map(([key, item]) => `
    <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(item)}</dd></div>
  `).join("");
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}
