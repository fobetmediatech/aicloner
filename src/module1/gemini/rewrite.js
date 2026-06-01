export async function rewritePromptWithGemini({
  instruction,
  prompt,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || "gemini-3-flash-preview"
}) {
  const cleanPrompt = String(prompt || "").trim();
  const cleanInstruction = String(instruction || "").trim();

  if (!cleanPrompt) {
    throw new Error("Prompt is required for Gemini rewrite");
  }

  if (!apiKey) {
    return {
      provider: "fallback",
      model,
      configured: false,
      instruction: cleanInstruction,
      input_prompt: cleanPrompt,
      output_prompt: cleanPrompt
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: cleanInstruction
        ? { parts: [{ text: cleanInstruction }] }
        : undefined,
      contents: [
        {
          role: "user",
          parts: [{ text: cleanPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95
      }
    })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Gemini rewrite failed: ${response.status} ${response.statusText} ${body ? JSON.stringify(body) : ""}`);
  }

  const output = extractText(body).trim();
  if (!output) {
    throw new Error("Gemini rewrite returned empty output");
  }

  return {
    provider: "gemini",
    model,
    configured: true,
    instruction: cleanInstruction,
    input_prompt: cleanPrompt,
    output_prompt: output,
    raw_response: body
  };
}

function extractText(body) {
  const parts = body?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n");
}
