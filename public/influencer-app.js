const state = {
  characters: [],
  selectedCharacterId: null,
  activeTaskId: null,
  pollAbort: null
};

const el = {
  selectMode: document.querySelector("#selectMode"),
  createMode: document.querySelector("#createMode"),
  selectCharacterView: document.querySelector("#selectCharacterView"),
  createCharacterForm: document.querySelector("#createCharacterForm"),
  characterSelect: document.querySelector("#characterSelect"),
  characterDetails: document.querySelector("#characterDetails"),
  newCharacterName: document.querySelector("#newCharacterName"),
  newVoiceSample: document.querySelector("#newVoiceSample"),
  newCharacterImages: document.querySelector("#newCharacterImages"),
  promptForm: document.querySelector("#promptForm"),
  basicPrompt: document.querySelector("#basicPrompt"),
  aspectRatio: document.querySelector("#aspectRatio"),
  expandedPrompt: document.querySelector("#expandedPrompt"),
  shotBreakdown: document.querySelector("#shotBreakdown"),
  generateVideoButton: document.querySelector("#generateVideoButton"),
  generatedVideo: document.querySelector("#generatedVideo"),
  videoPlaceholder: document.querySelector("#videoPlaceholder"),
  spinner: document.querySelector("#spinner"),
  statusText: document.querySelector("#statusText"),
  clearButton: document.querySelector("#clearButton")
};

el.selectMode.addEventListener("click", () => setCharacterMode("select"));
el.createMode.addEventListener("click", () => setCharacterMode("create"));
el.characterSelect.addEventListener("change", () => {
  state.selectedCharacterId = el.characterSelect.value;
  renderCharacterDetails();
});
el.createCharacterForm.addEventListener("submit", createCharacter);
el.promptForm.addEventListener("submit", expandPrompt);
el.generateVideoButton.addEventListener("click", generateVideo);
el.clearButton.addEventListener("click", clearPrompt);

loadCharacters();

async function loadCharacters() {
  state.characters = await api("/api/characters");
  if (!state.selectedCharacterId && state.characters[0]) {
    state.selectedCharacterId = state.characters[0].id;
  }
  renderCharacters();
}

function renderCharacters() {
  el.characterSelect.innerHTML = state.characters.map((character) => (
    `<option value="${escapeHtml(character.id)}">${escapeHtml(character.display_name || character.id)}</option>`
  )).join("");

  if (!state.characters.length) {
    el.characterSelect.innerHTML = `<option value="">No characters yet</option>`;
  }
  if (state.selectedCharacterId) el.characterSelect.value = state.selectedCharacterId;
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
    Images: String(character.reference_images?.length || character.asset_counts?.reference_images || 0),
    Voice: character.voice_sample ? "uploaded" : "missing",
    Element: character.kling_element_id ? "ready" : "not attached",
    Status: character.source_status || character.consent_status || "draft"
  });
}

async function createCharacter(event) {
  event.preventDefault();
  setStatus("Creating character...");
  setCreateBusy(true);
  try {
    const voiceFile = el.newVoiceSample.files[0];
    const imageFiles = Array.from(el.newCharacterImages.files);
    const character = await api("/api/characters", {
      method: "POST",
      body: {
        display_name: el.newCharacterName.value.trim(),
        voice_sample: voiceFile ? await fileToData(voiceFile) : null,
        images: await Promise.all(imageFiles.map(fileToData))
      }
    });

    state.selectedCharacterId = character.id;
    el.createCharacterForm.reset();
    setCharacterMode("select");
    await loadCharacters();
    setStatus("Character ready");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setCreateBusy(false);
  }
}

async function expandPrompt(event) {
  event.preventDefault();
  const character = selectedCharacter();
  if (!character) return setStatus("Select or create a character first.", true);

  setPromptBusy(true);
  setStatus("Building cinematic prompt...");
  try {
    const result = await api("/api/influencer/expand-prompt", {
      method: "POST",
      body: {
        character_id: character.id,
        prompt: el.basicPrompt.value.trim(),
        aspect_ratio: el.aspectRatio.value
      }
    });

    el.expandedPrompt.value = result.prompt;
    renderShotBreakdown(result);
    setStatus("Prompt ready");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setPromptBusy(false);
  }
}

async function generateVideo() {
  const character = selectedCharacter();
  if (!character) return setStatus("Select or create a character first.", true);
  const prompt = el.expandedPrompt.value.trim();
  if (!prompt) return setStatus("Build or paste a cinematic prompt first.", true);

  cancelPoll();
  setGenerateBusy(true);
  setStatus("Submitting to Kling...");
  try {
    const result = await api("/api/module1/generate-video", {
      method: "POST",
      body: {
        character_id: character.id,
        prompt,
        aspect_ratio: el.aspectRatio.value
      }
    });

    if (result.video_url) {
      setVideo(result.video_url);
      setStatus("Video ready");
      return;
    }

    if (!result.task_id) {
      throw new Error("Kling did not return a task_id.");
    }

    state.activeTaskId = result.task_id;
    setStatus(`Waiting for Kling task ${result.task_id}`);
    await pollTask(result.task_id);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setGenerateBusy(false);
  }
}

async function pollTask(taskId) {
  const controller = new AbortController();
  state.pollAbort = controller;

  while (true) {
    await sleep(5000);
    const response = await api(`/api/module1/kling-task?task_id=${encodeURIComponent(taskId)}`, {
      signal: controller.signal
    });

    const status = String(response.task_status || "").toLowerCase();
    setStatus(status ? `Kling status: ${status}` : "Kling status: unknown");

    if (response.video_url) {
      setVideo(response.video_url);
      setStatus("Video ready");
      return;
    }

    if (["failed", "failure", "fail"].includes(status)) {
      throw new Error(`Kling task failed: ${summarizeKlingFailure(response)}`);
    }

    if (controller.signal.aborted) {
      throw new Error("Cancelled.");
    }
  }
}

function renderShotBreakdown(result) {
  const shots = result.shots || [];
  const dialogue = result.dialogue || [];
  el.shotBreakdown.innerHTML = `
    <div class="miniHeader">10-second shot plan</div>
    ${shots.map((shot, index) => `
      <article>
        <strong>${escapeHtml(shot.time)} · Shot ${index + 1}</strong>
        <span>${escapeHtml(shot.framing)}</span>
        <em>${escapeHtml(shot.camera_motion)}</em>
      </article>
    `).join("")}
    <div class="miniHeader">Dialogue</div>
    ${dialogue.map((item) => `
      <article>
        <strong>${escapeHtml(item.time)}</strong>
        <span>${escapeHtml(item.line)}</span>
      </article>
    `).join("")}
  `;
}

function setCharacterMode(mode) {
  const create = mode === "create";
  el.createCharacterForm.classList.toggle("hidden", !create);
  el.selectCharacterView.classList.toggle("hidden", create);
  el.createMode.classList.toggle("active", create);
  el.selectMode.classList.toggle("active", !create);
}

function clearPrompt() {
  cancelPoll();
  el.expandedPrompt.value = "";
  el.shotBreakdown.innerHTML = "";
  el.generatedVideo.removeAttribute("src");
  el.videoPlaceholder.classList.remove("hidden");
  setStatus("Ready");
}

function selectedCharacter() {
  return state.characters.find((character) => character.id === state.selectedCharacterId) || null;
}

function setCreateBusy(isBusy) {
  el.createCharacterForm.querySelectorAll("button, input").forEach((node) => { node.disabled = isBusy; });
}

function setPromptBusy(isBusy) {
  el.promptForm.querySelectorAll("button, input, textarea, select").forEach((node) => { node.disabled = isBusy; });
}

function setGenerateBusy(isBusy) {
  el.generateVideoButton.disabled = isBusy;
  el.spinner.classList.toggle("hidden", !isBusy);
}

function setStatus(message, isError = false) {
  el.statusText.textContent = message;
  el.statusText.classList.toggle("error", isError);
}

function setVideo(videoUrl) {
  el.generatedVideo.src = videoUrl;
  el.generatedVideo.load();
  el.videoPlaceholder.classList.add("hidden");
}

function summarizeKlingFailure(response) {
  const detail = response?.response?.data?.task_status_msg
    || response?.response?.data?.task_result?.message
    || response?.response?.data?.message
    || response?.response?.message
    || response?.response?.msg
    || JSON.stringify(response?.response || response);
  return String(detail || "No failure detail returned").slice(0, 500);
}

function cancelPoll() {
  if (state.pollAbort) state.pollAbort.abort();
  state.pollAbort = null;
  state.activeTaskId = null;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[char]));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
