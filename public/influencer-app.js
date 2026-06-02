const state = {
  characters: [],
  selectedCharacterId: null,
  activeTaskId: null,
  pollAbort: null,
  directorQuestions: [],
  activeQuestionIndex: 0,
  selectedGeneratedSheetUrl: null
};

const el = {
  generateCharacterForm: document.querySelector("#generateCharacterForm"),
  generatedCharacterName: document.querySelector("#generatedCharacterName"),
  characterPrompt: document.querySelector("#characterPrompt"),
  characterAspectRatio: document.querySelector("#characterAspectRatio"),
  characterSpinner: document.querySelector("#characterSpinner"),
  characterGenerateStatus: document.querySelector("#characterGenerateStatus"),
  characterImageGrid: document.querySelector("#characterImageGrid"),
  publishPanel: document.querySelector("#publishPanel"),
  publishCharacterButton: document.querySelector("#publishCharacterButton"),
  imageModal: document.querySelector("#imageModal"),
  imageModalTitle: document.querySelector("#imageModalTitle"),
  imageModalClose: document.querySelector("#imageModalClose"),
  imageModalImg: document.querySelector("#imageModalImg"),
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
  askQuestionsButton: document.querySelector("#askQuestionsButton"),
  followupQuestionsButton: document.querySelector("#followupQuestionsButton"),
  questionnairePanel: document.querySelector("#questionnairePanel"),
  questionList: document.querySelector("#questionList"),
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

el.generateCharacterForm.addEventListener("submit", generateKlingCharacter);
el.publishCharacterButton.addEventListener("click", publishGeneratedCharacter);
el.imageModalClose.addEventListener("click", closeImageModal);
el.imageModal.addEventListener("click", (event) => {
  if (event.target === el.imageModal) closeImageModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeImageModal();
});
el.selectMode.addEventListener("click", () => setCharacterMode("select"));
el.createMode.addEventListener("click", () => setCharacterMode("create"));
el.characterSelect.addEventListener("change", () => {
  state.selectedCharacterId = el.characterSelect.value;
  renderCharacterDetails();
});
el.createCharacterForm.addEventListener("submit", createCharacter);
el.askQuestionsButton.addEventListener("click", () => askDirectionQuestions(false));
el.followupQuestionsButton.addEventListener("click", () => askDirectionQuestions(true));
el.promptForm.addEventListener("submit", expandPrompt);
el.generateVideoButton.addEventListener("click", generateVideo);
el.clearButton.addEventListener("click", clearPrompt);

loadCharacters();
initUiEnhancements();

async function generateKlingCharacter(event) {
  event.preventDefault();
  setCharacterGenerateBusy(true);
  setCharacterGenerateStatus("Generating character sheet with Gemini...");
  el.characterImageGrid.innerHTML = "";

  try {
    const result = await api("/api/influencer/generate-character", {
      method: "POST",
      body: {
        display_name: el.generatedCharacterName.value.trim(),
        prompt: el.characterPrompt.value.trim(),
        aspect_ratio: el.characterAspectRatio.value
      }
    });

    await loadCharacters();
    const generatedImages = result.reference_images || [];
    state.selectedGeneratedSheetUrl = result.character.character_sheet_url || generatedImages[0] || null;
    renderGeneratedCharacterImages(generatedImages);
    state.lastGeneratedCharacterId = result.character.id;
    el.publishPanel.classList.toggle("hidden", result.publish_status !== "local_only");
    setCharacterGenerateStatus(`${generatedImages.length || 1} character sheet option${generatedImages.length === 1 ? "" : "s"} ready: ${result.character.display_name || result.character.id}. Select it in Step 1 when ready.`);
  } catch (error) {
    setCharacterGenerateStatus(error.message, true);
  } finally {
    setCharacterGenerateBusy(false);
  }
}

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

async function publishGeneratedCharacter() {
  const characterId = state.lastGeneratedCharacterId || selectedCharacter()?.id;
  if (!characterId) return setCharacterGenerateStatus("Generate or select a character first.", true);

  setCharacterGenerateBusy(true);
  setCharacterGenerateStatus("Preparing public GitHub raw URL...");
  try {
    const result = await api("/api/influencer/publish-character-sheet", {
      method: "POST",
      body: { character_id: characterId }
    });
    await loadCharacters();
    el.publishPanel.classList.add("hidden");
    setCharacterGenerateStatus(`${result.message} Files: ${result.files_to_push?.join(", ") || "none"}`);
  } catch (error) {
    setCharacterGenerateStatus(error.message, true);
  } finally {
    setCharacterGenerateBusy(false);
  }
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
        aspect_ratio: el.aspectRatio.value,
        questionnaire_answers: collectQuestionnaireAnswers()
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

async function askDirectionQuestions(isFollowup) {
  const character = selectedCharacter();
  if (!character) return setStatus("Select or create a character first.", true);
  if (!el.basicPrompt.value.trim()) return setStatus("Write a basic video idea first.", true);

  setPromptBusy(true);
  setStatus(isFollowup ? "Asking Gemini for follow-up direction..." : "Asking Gemini for director questions...");
  try {
    const result = await api("/api/influencer/prompt-questions", {
      method: "POST",
      body: {
        character_id: character.id,
        prompt: el.basicPrompt.value.trim(),
        aspect_ratio: el.aspectRatio.value,
        questionnaire_answers: isFollowup ? collectQuestionnaireAnswers() : []
      }
    });

    if (!result.questions.length) {
      setStatus("Gemini says the direction is clear enough.");
      return;
    }

    renderQuestions(result.questions, isFollowup);
    setStatus("Answer the director questions, then build the cinematic prompt.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setPromptBusy(false);
  }
}

async function generateVideo() {
  const character = selectedCharacter();
  if (!character) return setStatus("Select or create a character first.", true);
  if (!character.reference_images?.some((url) => /^https?:\/\//.test(String(url)))) {
    return setStatus("This character is not ready for Kling video. Publish the generated sheet and push it first, or select a character with public HTTPS reference images.", true);
  }
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

function renderGeneratedCharacterImages(urls) {
  if (!urls.length) {
    el.characterImageGrid.innerHTML = "";
    return;
  }

  el.characterImageGrid.innerHTML = urls.map((url, index) => `
    <figure class="imageTile${url === state.selectedGeneratedSheetUrl ? " selected" : ""}">
      <img src="${escapeHtml(url)}" alt="Generated character reference ${index + 1}" />
      <figcaption>
        <span>Reference ${index + 1}</span>
        <div class="imageActions">
          <button class="btn-secondary" type="button" data-select-sheet="${escapeHtml(url)}">Select</button>
          <button class="btn-primary" type="button" data-preview-image="${escapeHtml(url)}" data-preview-title="Reference ${index + 1}">Inspect</button>
        </div>
      </figcaption>
    </figure>
  `).join("");

  el.characterImageGrid.querySelectorAll("[data-preview-image]").forEach((button) => {
    button.addEventListener("click", () => openImageModal(button.dataset.previewImage, button.dataset.previewTitle));
  });
  el.characterImageGrid.querySelectorAll("[data-select-sheet]").forEach((button) => {
    button.addEventListener("click", () => selectGeneratedCharacterSheet(button.dataset.selectSheet, urls));
  });
  applyButtonInteractions(el.characterImageGrid.querySelectorAll("button"));
}

async function selectGeneratedCharacterSheet(url, urls) {
  const characterId = state.lastGeneratedCharacterId || selectedCharacter()?.id;
  if (!characterId) return setCharacterGenerateStatus("Generate a character first.", true);

  setCharacterGenerateBusy(true);
  setCharacterGenerateStatus("Saving selected character sheet...");
  try {
    const result = await api("/api/influencer/select-character-sheet", {
      method: "POST",
      body: {
        character_id: characterId,
        character_sheet_url: url
      }
    });
    state.selectedGeneratedSheetUrl = result.character_sheet_url;
    await loadCharacters();
    renderGeneratedCharacterImages(urls);
    setCharacterGenerateStatus(`Selected Reference ${urls.indexOf(url) + 1} for ${result.character.display_name || result.character.id}. Use this character in Step 1.`);
  } catch (error) {
    setCharacterGenerateStatus(error.message, true);
  } finally {
    setCharacterGenerateBusy(false);
  }
}

function renderQuestions(questions, append) {
  el.questionnairePanel.classList.remove("hidden");
  const normalizedQuestions = questions.map((question, index) => ({
    id: slugClient(question.id || `q${index + 1}`),
    question: String(question.question || "").trim(),
    hint: String(question.hint || "").trim(),
    answer: ""
  })).filter((question) => question.question);

  if (append) {
    saveActiveQuestionAnswer();
    state.directorQuestions = state.directorQuestions.concat(normalizedQuestions);
    state.activeQuestionIndex = Math.max(0, state.directorQuestions.length - normalizedQuestions.length);
  } else {
    state.directorQuestions = normalizedQuestions;
    state.activeQuestionIndex = 0;
  }

  renderActiveQuestion();
}

function collectQuestionnaireAnswers() {
  saveActiveQuestionAnswer();
  return state.directorQuestions.map((item, index) => ({
    id: item.id || `q${index + 1}`,
    question: item.question,
    answer: item.answer || ""
  })).filter((item) => item.question && item.answer);
}

function renderActiveQuestion() {
  const questions = state.directorQuestions;
  if (!questions.length) {
    el.questionList.innerHTML = "";
    return;
  }

  const activeIndex = Math.min(Math.max(state.activeQuestionIndex, 0), questions.length - 1);
  state.activeQuestionIndex = activeIndex;
  const active = questions[activeIndex];

  el.questionList.innerHTML = `
    <div class="questionStepper" role="tablist" aria-label="Director question selector">
      ${questions.map((question, index) => `
        <button
          class="questionChip${index === activeIndex ? " active" : ""}${question.answer ? " answered" : ""}"
          type="button"
          data-question-index="${index}"
          aria-label="Question ${index + 1}"
          aria-selected="${index === activeIndex ? "true" : "false"}"
        >${index + 1}</button>
      `).join("")}
    </div>
    <label class="questionItem" data-question-id="${escapeHtml(active.id || `q${activeIndex + 1}`)}">
      <div class="questionMeta">
        <span>Question ${activeIndex + 1} of ${questions.length}</span>
        <strong>${escapeHtml(active.question)}</strong>
      </div>
      ${active.hint ? `<em>${escapeHtml(active.hint)}</em>` : ""}
      <textarea rows="5" placeholder="Answer with the detail you want in the video.">${escapeHtml(active.answer || "")}</textarea>
    </label>
    <div class="questionNav">
      <button class="btn-secondary" type="button" data-question-prev ${activeIndex === 0 ? "disabled" : ""}>Previous</button>
      <span class="mutedSmall">${answeredQuestionCount()} of ${questions.length} answered</span>
      <button class="btn-secondary" type="button" data-question-next ${activeIndex === questions.length - 1 ? "disabled" : ""}>Next</button>
    </div>
  `;

  el.questionList.querySelector("textarea")?.addEventListener("input", (event) => {
    questions[state.activeQuestionIndex].answer = event.target.value;
    updateQuestionProgressText();
  });

  el.questionList.querySelectorAll("[data-question-index]").forEach((button) => {
    button.addEventListener("click", () => {
      saveActiveQuestionAnswer();
      state.activeQuestionIndex = Number(button.dataset.questionIndex);
      renderActiveQuestion();
    });
  });

  el.questionList.querySelector("[data-question-prev]")?.addEventListener("click", () => {
    saveActiveQuestionAnswer();
    state.activeQuestionIndex = Math.max(0, state.activeQuestionIndex - 1);
    renderActiveQuestion();
  });

  el.questionList.querySelector("[data-question-next]")?.addEventListener("click", () => {
    saveActiveQuestionAnswer();
    state.activeQuestionIndex = Math.min(questions.length - 1, state.activeQuestionIndex + 1);
    renderActiveQuestion();
  });

  applyButtonInteractions(el.questionList.querySelectorAll("button"));
}

function saveActiveQuestionAnswer() {
  if (!state.directorQuestions.length) return;
  const textarea = el.questionList.querySelector(".questionItem textarea");
  if (!textarea) return;
  state.directorQuestions[state.activeQuestionIndex].answer = textarea.value.trim();
}

function updateQuestionProgressText() {
  const progress = el.questionList.querySelector(".questionNav .mutedSmall");
  if (progress) {
    progress.textContent = `${answeredQuestionCount()} of ${state.directorQuestions.length} answered`;
  }
}

function answeredQuestionCount() {
  return state.directorQuestions.filter((question) => String(question.answer || "").trim()).length;
}

function openImageModal(url, title) {
  el.imageModalTitle.textContent = title || "Generated character sheet";
  el.imageModalImg.src = url;
  el.imageModal.classList.remove("hidden");
}

function closeImageModal() {
  el.imageModal.classList.add("hidden");
  el.imageModalImg.removeAttribute("src");
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
  el.questionnairePanel.classList.add("hidden");
  el.questionList.innerHTML = "";
  state.directorQuestions = [];
  state.activeQuestionIndex = 0;
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

function setCharacterGenerateBusy(isBusy) {
  el.generateCharacterForm.querySelectorAll("button, input, textarea, select").forEach((node) => { node.disabled = isBusy; });
  el.characterSpinner.classList.toggle("hidden", !isBusy);
}

function setStatus(message, isError = false) {
  el.statusText.textContent = message;
  el.statusText.classList.toggle("error", isError);
}

function setCharacterGenerateStatus(message, isError = false) {
  el.characterGenerateStatus.textContent = message;
  el.characterGenerateStatus.classList.toggle("error", isError);
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

function slugClient(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `q-${Date.now()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initUiEnhancements() {
  initPlatinumCursor();
  initWorkflowTabs();
  initRevealOnScroll();
  applyButtonInteractions(document.querySelectorAll("button, .textLink"));
}

function initPlatinumCursor() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const cursor = document.createElement("div");
  cursor.id = "platinumCursor";
  cursor.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursor);

  document.addEventListener("mousemove", (event) => {
    document.body.classList.add("cursor-ready");
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });

  document.addEventListener("mouseover", (event) => {
    if (event.target.closest("button, a, select, input, textarea, [role='tab']")) {
      document.body.classList.add("cursor-hover");
    }
  });

  document.addEventListener("mouseout", (event) => {
    if (event.target.closest("button, a, select, input, textarea, [role='tab']")) {
      document.body.classList.remove("cursor-hover");
    }
  });
}

function initWorkflowTabs() {
  document.querySelectorAll("[data-target]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = document.querySelector(tab.dataset.target);
      if (!target) return;
      const offset = 60;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll("[data-target]").forEach((tab) => tab.classList.remove("active"));
        const activeTab = document.querySelector(`[data-target="#${id}"]`);
        if (activeTab) activeTab.classList.add("active");
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('[id^="section-"]').forEach((section) => observer.observe(section));
}

function initRevealOnScroll() {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  document.querySelectorAll(".reveal").forEach((section) => revealObserver.observe(section));
}

function applyButtonInteractions(buttons) {
  buttons.forEach((button) => {
    if (button.dataset.interactionsReady) return;
    button.dataset.interactionsReady = "true";

    if (button.matches(".btn-primary, .btn-secondary")) {
      button.addEventListener("mousemove", (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        button.style.transition = "transform 0.08s ease";
        button.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
      });

      button.addEventListener("mouseleave", () => {
        button.style.transition = "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
        button.style.transform = "translate(0, 0)";
      });
    }

    if (button.matches(".btn-primary, .primary")) {
      button.addEventListener("click", (event) => {
        const rect = button.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        button.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      });
    }
  });
}
