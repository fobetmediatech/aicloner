export class KlingClient {
  constructor({
    token = process.env.KLING_API_TOKEN,
    baseUrl = process.env.KLING_API_BASE_URL || "https://api-singapore.klingai.com",
    taskStatusPathTemplate = process.env.KLING_TASK_STATUS_PATH_TEMPLATE
  } = {}) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.taskStatusPathTemplate = taskStatusPathTemplate || null;
  }

  async createOmniVideo(payload) {
    this.#requireToken();
    return this.#request("/v1/videos/omni-video", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async queryTask(taskId) {
    this.#requireToken();
    if (!this.taskStatusPathTemplate) {
      throw new Error("Kling task status endpoint is not configured. Set KLING_TASK_STATUS_PATH_TEMPLATE after verifying it with the account.");
    }
    const path = this.taskStatusPathTemplate.replace("{task_id}", encodeURIComponent(taskId));
    return this.#request(path, { method: "GET" });
  }

  async #request(path, init) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {})
      }
    });

    const text = await response.text();
    const body = text ? safeJson(text) : null;

    if (!response.ok) {
      const detail = typeof body === "object" ? JSON.stringify(body) : text;
      throw new Error(`Kling API ${response.status} ${response.statusText}: ${detail}`);
    }

    return body;
  }

  #requireToken() {
    if (!this.token) {
      throw new Error("KLING_API_TOKEN is required for live Kling calls");
    }
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
