const state = {
  characters: [],
  selectedCharacterId: null,
  activeTaskId: null,
  pollAbort: null,
  directorQuestions: [],
  activeQuestionIndex: 0,
  selectedGeneratedSheetUrl: null,
  voices: [],
  voicesStatus: "idle",
  voiceMode: "existing",
  selectedVoiceId: null,
  confirmedVoiceId: null,
  designedVoicePreviews: [],
  selectedDesignedVoiceId: null,
  voiceDesignStatus: "idle",
  dialogue: "",
  audioStatus: "idle",
  audioUrl: null,
  audioBlob: null,
  audioDurationSeconds: null,
  videoUrl: null,
  videoDurationSeconds: null,
  attachments: {
    characterPrompt: [],
    basicPrompt: [],
    expandedPrompt: [],
    voiceDesignPrompt: []
  }
};

const defaultVoicePreviewText = "Mumbai is not just a city. It is a feeling, chaotic, beautiful, and deeply intimate. This city made me who I am today.";

const el = {
  generateCharacterForm: document.querySelector("#generateCharacterForm"),
  generatedCharacterName: document.querySelector("#generatedCharacterName"),
  builderAge: document.querySelector("#builderAge"),
  builderEthnicity: document.querySelector("#builderEthnicity"),
  builderGender: document.querySelector("#builderGender"),
  builderFace: document.querySelector("#builderFace"),
  builderHair: document.querySelector("#builderHair"),
  builderBody: document.querySelector("#builderBody"),
  builderOutfit: document.querySelector("#builderOutfit"),
  builderAccessories: document.querySelector("#builderAccessories"),
  buildCharacterPromptButton: document.querySelector("#buildCharacterPromptButton"),
  characterPrompt: document.querySelector("#characterPrompt"),
  characterPromptAttachments: document.querySelector("#characterPromptAttachments"),
  characterPromptAttachmentList: document.querySelector("#characterPromptAttachmentList"),
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
  basicPromptAttachments: document.querySelector("#basicPromptAttachments"),
  basicPromptAttachmentList: document.querySelector("#basicPromptAttachmentList"),
  aspectRatio: document.querySelector("#aspectRatio"),
  expandedPrompt: document.querySelector("#expandedPrompt"),
  expandedPromptAttachments: document.querySelector("#expandedPromptAttachments"),
  expandedPromptAttachmentList: document.querySelector("#expandedPromptAttachmentList"),
  shotBreakdown: document.querySelector("#shotBreakdown"),
  generateVideoButton: document.querySelector("#generateVideoButton"),
  generatedVideo: document.querySelector("#generatedVideo"),
  videoPlaceholder: document.querySelector("#videoPlaceholder"),
  spinner: document.querySelector("#spinner"),
  statusText: document.querySelector("#statusText"),
  clearButton: document.querySelector("#clearButton"),
  voiceExistingMode: document.querySelector("#voiceExistingMode"),
  voiceDesignMode: document.querySelector("#voiceDesignMode"),
  existingVoicePanel: document.querySelector("#existingVoicePanel"),
  loadVoicesButton: document.querySelector("#loadVoicesButton"),
  voiceStatusText: document.querySelector("#voiceStatusText"),
  voiceGrid: document.querySelector("#voiceGrid"),
  voiceConfirmPanel: document.querySelector("#voiceConfirmPanel"),
  confirmVoiceButton: document.querySelector("#confirmVoiceButton"),
  selectedVoiceText: document.querySelector("#selectedVoiceText"),
  voiceDesignForm: document.querySelector("#voiceDesignForm"),
  voiceDesignPrompt: document.querySelector("#voiceDesignPrompt"),
  voiceDesignPromptAttachments: document.querySelector("#voiceDesignPromptAttachments"),
  voiceDesignPromptAttachmentList: document.querySelector("#voiceDesignPromptAttachmentList"),
  voicePreviewText: document.querySelector("#voicePreviewText"),
  designedVoiceName: document.querySelector("#designedVoiceName"),
  designVoiceButton: document.querySelector("#designVoiceButton"),
  voiceDesignSpinner: document.querySelector("#voiceDesignSpinner"),
  voiceDesignStatusText: document.querySelector("#voiceDesignStatusText"),
  voiceDesignGrid: document.querySelector("#voiceDesignGrid"),
  voiceDesignConfirmPanel: document.querySelector("#voiceDesignConfirmPanel"),
  saveDesignedVoiceButton: document.querySelector("#saveDesignedVoiceButton"),
  selectedDesignedVoiceText: document.querySelector("#selectedDesignedVoiceText"),
  audioForm: document.querySelector("#audioForm"),
  dialogueInput: document.querySelector("#dialogueInput"),
  videoDurationText: document.querySelector("#videoDurationText"),
  generateAudioButton: document.querySelector("#generateAudioButton"),
  audioSpinner: document.querySelector("#audioSpinner"),
  audioStatusText: document.querySelector("#audioStatusText"),
  audioPreviewPanel: document.querySelector("#audioPreviewPanel"),
  audioPlayer: document.querySelector("#audioPlayer"),
  durationSyncPanel: document.querySelector("#durationSyncPanel"),
  syncVideoDurationText: document.querySelector("#syncVideoDurationText"),
  syncAudioDurationText: document.querySelector("#syncAudioDurationText"),
  syncDifferenceText: document.querySelector("#syncDifferenceText"),
  regenerateAudioButton: document.querySelector("#regenerateAudioButton"),
  confirmAudioButton: document.querySelector("#confirmAudioButton"),
  audioConfirmText: document.querySelector("#audioConfirmText")
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
el.buildCharacterPromptButton.addEventListener("click", buildCharacterPromptFromFields);
el.characterPromptAttachments.addEventListener("change", () => handleAttachmentInput("characterPrompt", el.characterPromptAttachments, el.characterPromptAttachmentList));
el.basicPromptAttachments.addEventListener("change", () => handleAttachmentInput("basicPrompt", el.basicPromptAttachments, el.basicPromptAttachmentList));
el.expandedPromptAttachments.addEventListener("change", () => handleAttachmentInput("expandedPrompt", el.expandedPromptAttachments, el.expandedPromptAttachmentList));
el.voiceDesignPromptAttachments.addEventListener("change", () => handleAttachmentInput("voiceDesignPrompt", el.voiceDesignPromptAttachments, el.voiceDesignPromptAttachmentList));
el.createCharacterForm.addEventListener("submit", createCharacter);
el.askQuestionsButton.addEventListener("click", () => askDirectionQuestions(false));
el.followupQuestionsButton.addEventListener("click", () => askDirectionQuestions(true));
el.promptForm.addEventListener("submit", expandPrompt);
el.generateVideoButton.addEventListener("click", generateVideo);
el.clearButton.addEventListener("click", clearPrompt);
el.voiceExistingMode.addEventListener("click", () => setVoiceMode("existing"));
el.voiceDesignMode.addEventListener("click", () => setVoiceMode("design"));
el.loadVoicesButton.addEventListener("click", loadElevenLabsVoices);
el.confirmVoiceButton.addEventListener("click", confirmSelectedVoice);
el.voiceDesignForm.addEventListener("submit", designVoicePreviews);
el.saveDesignedVoiceButton.addEventListener("click", saveDesignedVoice);
el.audioForm.addEventListener("submit", generateAudio);
el.regenerateAudioButton.addEventListener("click", generateAudio);
el.confirmAudioButton.addEventListener("click", confirmAudio);
el.generatedVideo.addEventListener("loadedmetadata", updateVideoDurationFromElement);
el.audioPlayer.addEventListener("loadedmetadata", updateAudioDurationFromElement);

loadCharacters();
initUiEnhancements();
if (el.voicePreviewText && !el.voicePreviewText.value.trim()) {
  el.voicePreviewText.value = defaultVoicePreviewText;
}

function buildCharacterPromptFromFields() {
  const age = fieldValue(el.builderAge, "25");
  const ethnicity = fieldValue(el.builderEthnicity, "Macedonian");
  const gender = fieldValue(el.builderGender, "woman");
  const face = fieldValue(el.builderFace, "elegant oval face, warm brown eyes, and a confident soft smile");
  const hair = fieldValue(el.builderHair, "dark hair styled in a neat low bun with a visible side part and natural stray flyaways");
  const body = fieldValue(el.builderBody, "curvy, thick, and fit physique with realistic body proportions");
  const outfit = fieldValue(el.builderOutfit, "simple black low-neck satin dress showing natural fabric creasing");
  const accessories = fieldValue(el.builderAccessories, "classic gold hoop earrings");
  const pronoun = gender === "man" ? "He" : gender === "person" ? "They" : "She";
  const possessive = gender === "man" ? "His" : gender === "person" ? "Their" : "Her";
  const noun = `${age}-year-old ${ethnicity} ${gender}`;

  el.characterPrompt.value = `A 3x3 grid layout containing 9 separate, highly consistent, unretouched DSLR photographic panels on a single clean, solid off-white studio sheet. Each panel features the exact same ${noun} with an ${face}. ${possessive} ${hair}. ${pronoun} maintains a ${body} across all views, wearing a ${outfit} and ${accessories}.

The top row (Row 1, Panels 1-3) features strict close-up headshots: 1. Straight-on frontal face detail, 2. Left three-quarter face detail, 3. Full side profile face detail. These close-ups emphasize high-resolution skin texture with visible pores, natural facial asymmetry, subtle moles, fine lines around the eyes, natural under-eye shadows, and slight micro-sweat sheen.

The middle row (Row 2, Panels 4-6) features medium waist-up portraits: 4. Straight-on frontal medium shot, 5. Right three-quarter medium shot, 6. Full side profile medium shot. These panels show the full hairstyle, dress silhouette, and consistent upper-body proportions.

The bottom row (Row 3, Panels 7-9) features full-body and alternative angles:
7. [CRUCIAL PANEL]: A perfectly symmetrical, straight-on frontal full-body standing shot, arms resting naturally at the sides, head facing directly forward, ensuring identical facial features and body proportions remain perfectly sharp and proportional from head to toe,
8. Left three-quarter full-body standing shot,
9. Straight back view showing the full back silhouette, hairstyle, and fit posture.

The lighting throughout all 9 panels is consistent, clean overhead softbox lighting that creates realistic, natural shadows to define facial and body structure without washing out details. Sharp focus across all panels using an 85mm lens at f/4 to prevent distortion and maintain a natural, subtle depth of field. Absolutely no text, no labels, no grid lines, no watermarks, no borders, no CGI elements, no 3D rendering, no airbrushed skin, and no digital smoothing on any panel.`;

  setCharacterGenerateStatus("3x3 character prompt built from fields.");
}

function fieldValue(input, fallback) {
  return String(input?.value || fallback).trim() || fallback;
}

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
        aspect_ratio: el.characterAspectRatio.value,
        attachments: state.attachments.characterPrompt
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
        questionnaire_answers: collectQuestionnaireAnswers(),
        attachments: state.attachments.basicPrompt
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
        questionnaire_answers: isFollowup ? collectQuestionnaireAnswers() : [],
        attachments: state.attachments.basicPrompt
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
        prompt: mergePromptWithAttachmentContext(prompt, state.attachments.expandedPrompt),
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
  state.videoUrl = null;
  state.videoDurationSeconds = null;
  resetAudioState();
  updateVideoDurationText();
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

function setAudioBusy(isBusy) {
  el.generateAudioButton.disabled = isBusy;
  el.regenerateAudioButton.disabled = isBusy;
  el.confirmAudioButton.disabled = isBusy || state.audioStatus !== "ready";
  el.audioSpinner.classList.toggle("hidden", !isBusy);
}

function setVoiceDesignBusy(isBusy) {
  el.designVoiceButton.disabled = isBusy;
  el.saveDesignedVoiceButton.disabled = isBusy;
  el.voiceDesignSpinner.classList.toggle("hidden", !isBusy);
}

function setCharacterGenerateBusy(isBusy) {
  el.generateCharacterForm.querySelectorAll("button, input, textarea, select").forEach((node) => { node.disabled = isBusy; });
  el.characterSpinner.classList.toggle("hidden", !isBusy);
}

function setStatus(message, isError = false) {
  el.statusText.textContent = message;
  el.statusText.classList.toggle("error", isError);
}

function setVoiceStatus(message, isError = false) {
  el.voiceStatusText.textContent = message;
  el.voiceStatusText.classList.toggle("error", isError);
}

function setVoiceDesignStatus(message, isError = false) {
  el.voiceDesignStatusText.textContent = message;
  el.voiceDesignStatusText.classList.toggle("error", isError);
}

function setAudioStatus(message, isError = false) {
  el.audioStatusText.textContent = message;
  el.audioStatusText.classList.toggle("error", isError);
}

function setCharacterGenerateStatus(message, isError = false) {
  el.characterGenerateStatus.textContent = message;
  el.characterGenerateStatus.classList.toggle("error", isError);
}

function setVideo(videoUrl) {
  state.videoUrl = videoUrl;
  el.generatedVideo.src = videoUrl;
  el.generatedVideo.load();
  el.videoPlaceholder.classList.add("hidden");
  updateVideoDurationText();
}

function setVoiceMode(mode) {
  state.voiceMode = mode === "design" ? "design" : "existing";
  const isDesign = state.voiceMode === "design";
  el.existingVoicePanel.classList.toggle("hidden", isDesign);
  el.voiceDesignForm.classList.toggle("hidden", !isDesign);
  el.voiceExistingMode.classList.toggle("active", !isDesign);
  el.voiceDesignMode.classList.toggle("active", isDesign);
  if (isDesign) hydrateVoiceDesignPrompt();
  if (!isDesign) ensureVoicesLoaded();
}

async function hydrateVoiceDesignPrompt() {
  const character = selectedCharacter();
  if (!el.designedVoiceName.value.trim() && character) {
    el.designedVoiceName.value = `${character.display_name || character.id} Voice`;
  }
  if (el.voiceDesignPrompt.value.trim()) return;

  if (!character) {
    setVoiceDesignStatus("Select a character first to generate a matching voice description.", true);
    return;
  }

  setVoiceDesignStatus("Asking Gemini for a voice design description...");
  try {
    const result = await api("/api/elevenlabs/voice-description", {
      method: "POST",
      body: {
        character_id: character.id,
        video_prompt: el.expandedPrompt.value.trim(),
        generated_video_url: state.videoUrl || "",
        dialogue: el.dialogueInput.value.trim(),
        attachments: state.attachments.voiceDesignPrompt
      }
    });
    el.voiceDesignPrompt.value = result.voice_description || "";
    if (result.preview_text && (!el.voicePreviewText.value.trim() || el.voicePreviewText.value.trim() === defaultVoicePreviewText)) {
      el.voicePreviewText.value = result.preview_text;
    }
    setVoiceDesignStatus(`Voice description ready via ${result.provider}`);
  } catch (error) {
    setVoiceDesignStatus(error.message, true);
  }
}

async function loadElevenLabsVoices() {
  if (state.voicesStatus === "loading") return;
  state.voicesStatus = "loading";
  setVoiceStatus("Loading ElevenLabs voices...");
  el.loadVoicesButton.disabled = true;
  try {
    const result = await api("/api/elevenlabs/voices");
    state.voices = Array.isArray(result.voices) ? result.voices : [];
    state.voicesStatus = "ready";
    renderVoices();
    setVoiceStatus(state.voices.length ? `${state.voices.length} voices loaded` : "No voices returned");
  } catch (error) {
    state.voicesStatus = "error";
    setVoiceStatus(error.message, true);
  } finally {
    el.loadVoicesButton.disabled = false;
  }
}

function ensureVoicesLoaded() {
  if (state.voices.length || state.voicesStatus !== "idle") return;
  loadElevenLabsVoices();
}

function renderVoices() {
  if (!state.voices.length) {
    el.voiceGrid.innerHTML = "";
    return;
  }

  el.voiceGrid.innerHTML = state.voices.map((voice) => {
    const labels = voice.labels && typeof voice.labels === "object"
      ? Object.entries(voice.labels).map(([key, value]) => `${key}: ${value}`).join(" · ")
      : "";
    const meta = [voice.category, labels].filter(Boolean).join(" · ");
    return `
      <article class="voiceCard${voice.voice_id === state.selectedVoiceId ? " selected" : ""}" data-voice-id="${escapeHtml(voice.voice_id)}">
        <div>
          <strong>${escapeHtml(voice.name || "Unnamed voice")}</strong>
          <span>${escapeHtml(meta || "No labels")}</span>
        </div>
        <div class="voiceActions">
          <button class="btn-secondary" type="button" data-select-voice="${escapeHtml(voice.voice_id)}">Select</button>
          ${voice.preview_url ? `<button class="btn-primary" type="button" data-preview-voice="${escapeHtml(voice.preview_url)}">Listen</button>` : ""}
        </div>
      </article>
    `;
  }).join("");

  el.voiceGrid.querySelectorAll("[data-select-voice]").forEach((button) => {
    button.addEventListener("click", () => selectVoice(button.dataset.selectVoice));
  });
  el.voiceGrid.querySelectorAll("[data-preview-voice]").forEach((button) => {
    button.addEventListener("click", () => previewVoice(button.dataset.previewVoice));
  });
  applyButtonInteractions(el.voiceGrid.querySelectorAll("button"));
}

function selectVoice(voiceId) {
  state.selectedVoiceId = voiceId;
  state.confirmedVoiceId = null;
  const voice = selectedVoice();
  el.voiceConfirmPanel.classList.remove("hidden");
  el.selectedVoiceText.textContent = voice ? `${voice.name || voice.voice_id} selected` : `${voiceId} selected`;
  el.audioForm.classList.add("hidden");
  renderVoices();
}

function selectedVoice() {
  return state.voices.find((voice) => voice.voice_id === state.selectedVoiceId) || null;
}

function previewVoice(previewUrl) {
  const audio = new Audio(previewUrl);
  audio.play().catch((error) => setVoiceStatus(`Preview failed: ${error.message}`, true));
}

function confirmSelectedVoice() {
  if (!state.selectedVoiceId) return setVoiceStatus("Select a voice first.", true);
  state.confirmedVoiceId = state.selectedVoiceId;
  const voice = selectedVoice();
  el.audioForm.classList.remove("hidden");
  updateVideoDurationText();
  setVoiceStatus(`Voice confirmed: ${voice?.name || state.confirmedVoiceId}`);
}

async function designVoicePreviews(event) {
  event.preventDefault();
  const voiceDescription = el.voiceDesignPrompt.value.trim();
  const previewText = el.voicePreviewText.value.trim();
  if (!voiceDescription) return setVoiceDesignStatus("Describe the voice first.", true);
  if (!previewText) return setVoiceDesignStatus("Add preview text first.", true);

  state.voiceDesignStatus = "loading";
  state.designedVoicePreviews = [];
  state.selectedDesignedVoiceId = null;
  el.voiceDesignGrid.innerHTML = "";
  el.voiceDesignConfirmPanel.classList.add("hidden");
  setVoiceDesignBusy(true);
  setVoiceDesignStatus("Designing voice previews...");

  try {
    const result = await api("/api/elevenlabs/voice-design", {
      method: "POST",
      body: {
        voice_description: voiceDescription,
        text: previewText
      }
    });
    state.designedVoicePreviews = Array.isArray(result.previews) ? result.previews : [];
    state.voiceDesignStatus = "ready";
    renderDesignedVoicePreviews();
    setVoiceDesignStatus(state.designedVoicePreviews.length ? `${state.designedVoicePreviews.length} voice previews ready` : "No previews returned");
  } catch (error) {
    state.voiceDesignStatus = "error";
    setVoiceDesignStatus(error.message, true);
  } finally {
    setVoiceDesignBusy(false);
  }
}

function renderDesignedVoicePreviews() {
  if (!state.designedVoicePreviews.length) {
    el.voiceDesignGrid.innerHTML = "";
    return;
  }

  el.voiceDesignGrid.innerHTML = state.designedVoicePreviews.map((preview, index) => `
    <article class="voiceCard${preview.generated_voice_id === state.selectedDesignedVoiceId ? " selected" : ""}" data-generated-voice-id="${escapeHtml(preview.generated_voice_id)}">
      <div>
        <strong>Designed preview ${index + 1}</strong>
        <span>${escapeHtml(preview.duration_secs ? `${Number(preview.duration_secs).toFixed(1)}s preview` : "Generated voice preview")}</span>
      </div>
      <audio controls src="${escapeHtml(preview.audio_url || "")}"></audio>
      <div class="voiceActions">
        <button class="btn-secondary" type="button" data-select-designed-voice="${escapeHtml(preview.generated_voice_id)}">Select</button>
      </div>
    </article>
  `).join("");

  el.voiceDesignGrid.querySelectorAll("[data-select-designed-voice]").forEach((button) => {
    button.addEventListener("click", () => selectDesignedVoice(button.dataset.selectDesignedVoice));
  });
  applyButtonInteractions(el.voiceDesignGrid.querySelectorAll("button"));
}

function selectDesignedVoice(generatedVoiceId) {
  state.selectedDesignedVoiceId = generatedVoiceId;
  el.voiceDesignConfirmPanel.classList.remove("hidden");
  el.selectedDesignedVoiceText.textContent = "Designed voice preview selected";
  renderDesignedVoicePreviews();
}

async function saveDesignedVoice() {
  if (!state.selectedDesignedVoiceId) return setVoiceDesignStatus("Select a designed voice preview first.", true);
  const voiceName = el.designedVoiceName.value.trim();
  if (!voiceName) return setVoiceDesignStatus("Add a saved voice name first.", true);

  setVoiceDesignBusy(true);
  setVoiceDesignStatus("Saving designed voice to ElevenLabs...");
  try {
    const result = await api("/api/elevenlabs/voice-design/save", {
      method: "POST",
      body: {
        generated_voice_id: state.selectedDesignedVoiceId,
        voice_name: voiceName,
        voice_description: el.voiceDesignPrompt.value.trim()
      }
    });
    state.selectedVoiceId = result.voice_id;
    state.confirmedVoiceId = result.voice_id;
    el.audioForm.classList.remove("hidden");
    updateVideoDurationText();
    setVoiceDesignStatus(`Voice saved and confirmed: ${result.name || result.voice_id}`);
  } catch (error) {
    setVoiceDesignStatus(error.message, true);
  } finally {
    setVoiceDesignBusy(false);
  }
}

async function generateAudio(event) {
  event?.preventDefault();
  if (!state.confirmedVoiceId) return setAudioStatus("Confirm a voice first.", true);
  const dialogue = el.dialogueInput.value.trim();
  if (!dialogue) return setAudioStatus("Enter the exact dialogue first.", true);

  state.dialogue = dialogue;
  state.audioStatus = "loading";
  setAudioStatus("Generating ElevenLabs audio...");
  setAudioBusy(true);
  el.audioPreviewPanel.classList.add("hidden");

  try {
    const response = await fetch(`/api/elevenlabs/text-to-speech/${encodeURIComponent(state.confirmedVoiceId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: dialogue })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || `Audio generation failed: ${response.status}`);
    }

    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioBlob = await response.blob();
    state.audioUrl = URL.createObjectURL(state.audioBlob);
    state.audioStatus = "ready";
    state.audioDurationSeconds = null;
    el.audioPlayer.src = state.audioUrl;
    el.audioPreviewPanel.classList.remove("hidden");
    updateDurationSyncPanel();
    setAudioStatus("Audio ready");
    setAudioBusy(false);
  } catch (error) {
    state.audioStatus = "error";
    setAudioStatus(error.message, true);
    setAudioBusy(false);
  }
}

function confirmAudio() {
  if (!state.audioUrl || !state.audioBlob) return setAudioStatus("Generate audio first.", true);
  const sync = durationSyncStatus();
  if (!sync.ready) return setAudioStatus("Load both video and audio durations before confirming.", true);
  if (!sync.matches) {
    return setAudioStatus(`Audio/video length mismatch: ${sync.difference.toFixed(2)}s difference. Regenerate or edit dialogue before Sync 3.0.`, true);
  }
  state.audioStatus = "ready";
  el.audioConfirmText.textContent = `Confirmed. videoUrl and audioUrl are duration-matched for Sync 3.0.`;
  setAudioStatus("Audio confirmed");
}

function resetAudioState() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.dialogue = "";
  state.audioStatus = "idle";
  state.audioUrl = null;
  state.audioBlob = null;
  state.audioDurationSeconds = null;
  el.dialogueInput.value = "";
  el.audioPlayer.removeAttribute("src");
  el.audioPreviewPanel.classList.add("hidden");
  updateDurationSyncPanel();
  setAudioStatus("Ready");
}

function updateVideoDurationFromElement() {
  state.videoDurationSeconds = Number.isFinite(el.generatedVideo.duration) ? el.generatedVideo.duration : null;
  updateVideoDurationText();
  updateDurationSyncPanel();
}

function updateAudioDurationFromElement() {
  state.audioDurationSeconds = Number.isFinite(el.audioPlayer.duration) ? el.audioPlayer.duration : null;
  updateDurationSyncPanel();
}

function updateVideoDurationText() {
  if (state.videoDurationSeconds) {
    el.videoDurationText.textContent = `${state.videoDurationSeconds.toFixed(1)} seconds`;
    return;
  }
  el.videoDurationText.textContent = state.videoUrl ? "Video loaded, reading duration..." : "No video loaded yet";
}

function durationSyncStatus() {
  const video = state.videoDurationSeconds;
  const audio = state.audioDurationSeconds;
  if (!video || !audio) {
    return { ready: false, matches: false, difference: 0 };
  }
  const difference = Math.abs(video - audio);
  const tolerance = Math.max(0.35, video * 0.06);
  return {
    ready: true,
    matches: difference <= tolerance,
    difference,
    tolerance
  };
}

function updateDurationSyncPanel() {
  if (!el.durationSyncPanel) return;
  const sync = durationSyncStatus();
  el.syncVideoDurationText.textContent = state.videoDurationSeconds ? `${state.videoDurationSeconds.toFixed(2)}s` : "--";
  el.syncAudioDurationText.textContent = state.audioDurationSeconds ? `${state.audioDurationSeconds.toFixed(2)}s` : "--";
  el.syncDifferenceText.textContent = sync.ready ? `${sync.difference.toFixed(2)}s` : "--";
  el.durationSyncPanel.classList.toggle("matched", sync.ready && sync.matches);
  el.durationSyncPanel.classList.toggle("mismatch", sync.ready && !sync.matches);
  if (sync.ready && sync.matches) {
    el.audioConfirmText.textContent = `Length match is within ${sync.tolerance.toFixed(2)}s. Ready for Sync 3.0.`;
  } else if (sync.ready) {
    el.audioConfirmText.textContent = `Length mismatch is ${sync.difference.toFixed(2)}s. Adjust dialogue or regenerate audio before Sync 3.0.`;
  } else {
    el.audioConfirmText.textContent = "Audio and video durations will be checked before Sync 3.0.";
  }
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

async function handleAttachmentInput(key, input, listEl) {
  const files = Array.from(input.files || []);
  state.attachments[key] = await Promise.all(files.map(fileToPromptAttachment));
  renderAttachmentList(key, listEl);
}

function fileToPromptAttachment(file) {
  const maxInlineBytes = 8 * 1024 * 1024;
  const base = {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file"
  };

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return Promise.resolve(base);
  }

  if (file.size > maxInlineBytes) {
    return Promise.resolve({
      ...base,
      skipped_data: true,
      note: "File is larger than 8 MB, so only metadata is sent as prompt context."
    });
  }

  return fileToData(file).then((data) => ({
    ...base,
    data_url: data.data_url
  }));
}

function renderAttachmentList(key, listEl) {
  const attachments = state.attachments[key] || [];
  if (!attachments.length) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = attachments.map((attachment, index) => `
    <article class="attachmentChip">
      ${attachment.data_url && attachment.kind === "image" ? `<img src="${escapeHtml(attachment.data_url)}" alt="" />` : `<span class="attachmentIcon">${attachment.kind === "video" ? "VID" : "IMG"}</span>`}
      <div>
        <strong>${escapeHtml(attachment.name)}</strong>
        <small>${escapeHtml(formatAttachmentMeta(attachment))}</small>
      </div>
      <button class="btn-secondary" type="button" data-remove-attachment="${index}">Remove</button>
    </article>
  `).join("");

  listEl.querySelectorAll("[data-remove-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.attachments[key].splice(Number(button.dataset.removeAttachment), 1);
      renderAttachmentList(key, listEl);
    });
  });
  applyButtonInteractions(listEl.querySelectorAll("button"));
}

function formatAttachmentMeta(attachment) {
  const kb = Math.max(1, Math.round(Number(attachment.size || 0) / 1024));
  return `${attachment.type || "file"} · ${kb} KB${attachment.skipped_data ? " · metadata only" : ""}`;
}

function mergePromptWithAttachmentContext(prompt, attachments) {
  const summary = attachmentContextText(attachments);
  return summary ? `${prompt}\n\nATTACHED REFERENCE CONTEXT:\n${summary}` : prompt;
}

function attachmentContextText(attachments) {
  const items = (attachments || []).map((attachment, index) => (
    `${index + 1}. ${attachment.kind || "file"} reference "${attachment.name}" (${attachment.type || "unknown type"}, ${Math.round(Number(attachment.size || 0) / 1024)} KB).`
  ));
  return items.join("\n");
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
      if (target.id === "section-audio-generation") ensureVoicesLoaded();
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
        if (id === "section-audio-generation") ensureVoicesLoaded();
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
