import crypto from "node:crypto";

export class KlingClient {
  constructor({
    token = process.env.KLING_API_TOKEN,
    accessKey = process.env.KLING_ACCESS_KEY,
    secretKey = process.env.KLING_SECRET_KEY,
    baseUrl = process.env.KLING_API_BASE_URL || "https://api-singapore.klingai.com",
    taskStatusPathTemplate = process.env.KLING_TASK_STATUS_PATH_TEMPLATE || "/v1/videos/omni-video/{task_id}"
  } = {}) {
    const cleanToken = String(token || "").trim();
    const cleanAccessKey = String(accessKey || "").trim();
    const cleanSecretKey = String(secretKey || "").trim();

    if (cleanToken && cleanToken.split(".").length === 3) {
      this.token = cleanToken;
      this.authSource = "KLING_API_TOKEN";
    } else if (cleanAccessKey && cleanSecretKey) {
      this.token = createKlingJwt({ accessKey: cleanAccessKey, secretKey: cleanSecretKey });
      this.authSource = "KLING_ACCESS_KEY/KLING_SECRET_KEY";
    } else {
      this.token = null;
      this.authSource = "missing";
    }

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

  async waitForVideo({ taskId, pollIntervalMs = 5_000 } = {}) {
    while (true) {
      const response = await this.queryTask(taskId);
      const status = extractTaskStatus(response);
      const videoUrl = extractVideoUrl(response);

      if (videoUrl) {
        return { response, video_url: videoUrl, status: status || "succeed" };
      }

      if (["failed", "failure", "FAILURE", "fail"].includes(status)) {
        throw new Error(`Kling task failed: ${JSON.stringify(response)}`);
      }

      await sleep(pollIntervalMs);
    }
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
      throw new Error("Set KLING_ACCESS_KEY + KLING_SECRET_KEY, or provide a valid 3-part KLING_API_TOKEN JWT, for live Kling calls");
    }
  }
}

export function extractTaskId(response) {
  return response?.task_id
    || response?.id
    || response?.data?.task_id
    || response?.data?.id
    || response?.data?.data?.task_id
    || response?.data?.data?.data?.task_id
    || null;
}

export function extractVideoUrl(response) {
  return response?.video_url
    || response?.url
    || response?.data?.video_url
    || response?.data?.url
    || response?.data?.task_result?.videos?.[0]?.url
    || response?.data?.data?.task_result?.videos?.[0]?.url
    || response?.data?.data?.data?.task_result?.videos?.[0]?.url
    || null;
}

export function extractTaskStatus(response) {
  return response?.task_status
    || response?.status
    || response?.data?.task_status
    || response?.data?.status
    || response?.data?.data?.task_status
    || response?.data?.data?.status
    || response?.data?.data?.data?.task_status
    || response?.data?.data?.data?.status
    || null;
}

function createKlingJwt({ accessKey, secretKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac("sha256", secretKey).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
