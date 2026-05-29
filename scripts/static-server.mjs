import { createReadStream, existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 4173);
const root = join(process.cwd(), "dist");
const envPath = join(process.cwd(), ".env");

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const openaiApiKey = process.env.OPENAI_API_KEY;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function handleEvaluate(request, response) {
  if (!openaiApiKey) {
    sendJson(response, 500, {
      error: "OPENAI_API_KEY environment variable is not set.",
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const model = body.model || "gpt-5.4-mini";
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      sendJson(response, 400, { error: "prompt is required." });
      return;
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "report_evaluation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                total_score: { type: "number" },
                feedback: { type: "string" },
                student_report: { type: "string" },
              },
              required: ["total_score", "feedback", "student_report"],
            },
          },
        },
      }),
    });

    const apiPayload = await apiResponse.json();

    if (!apiResponse.ok) {
      sendJson(response, apiResponse.status, {
        error: apiPayload.error?.message || "OpenAI API request failed.",
      });
      return;
    }

    const outputText =
      apiPayload.output_text ||
      apiPayload.output
        ?.flatMap((item) => item.content ?? [])
        .map((content) => content.text)
        .filter(Boolean)
        .join("\n");

    if (!outputText) {
      sendJson(response, 502, { error: "OpenAI response did not include text output." });
      return;
    }

    sendJson(response, 200, {
      result: JSON.parse(outputText),
      raw: apiPayload,
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected evaluation error.",
    });
  }
}

function supabaseHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  };
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseEndpoint() {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  return `${baseUrl}/rest/v1/app_state`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleState(request, response) {
  if (!hasSupabaseConfig()) {
    sendJson(response, 500, {
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.",
    });
    return;
  }

  const endpoint = supabaseEndpoint();
  const stateId = "default";

  try {
    if (request.method === "GET") {
      const supabaseResponse = await fetchWithTimeout(`${endpoint}?id=eq.${stateId}&select=data`, {
        headers: supabaseHeaders(),
      });
      const payload = await supabaseResponse.json();

      if (!supabaseResponse.ok) {
        sendJson(response, supabaseResponse.status, {
          error: payload.message || "Failed to load app state.",
        });
        return;
      }

      sendJson(response, 200, { data: payload[0]?.data ?? null });
      return;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      const data = body.data;

      if (!data || typeof data !== "object") {
        sendJson(response, 400, { error: "data object is required." });
        return;
      }

      const supabaseResponse = await fetchWithTimeout(`${endpoint}?on_conflict=id`, {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({
          id: stateId,
          data,
          updated_at: new Date().toISOString(),
        }),
      });
      const payload = await supabaseResponse.json();

      if (!supabaseResponse.ok) {
        sendJson(response, supabaseResponse.status, {
          error: payload.message || "Failed to save app state.",
        });
        return;
      }

      sendJson(response, 200, { data: payload[0]?.data ?? data });
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, error instanceof Error && error.name === "AbortError" ? 504 : 500, {
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Supabase 저장소 응답 시간이 초과되었습니다."
          : error instanceof Error
            ? error.message
            : "Unexpected state storage error.",
    });
  }
}

createServer(async (request, response) => {
  if (request.method === "POST" && request.url?.startsWith("/api/evaluate")) {
    await handleEvaluate(request, response);
    return;
  }

  if (request.url?.startsWith("/api/state")) {
    await handleState(request, response);
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, requestedPath);

  if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) {
    filePath = join(root, "index.html");
  }

  response.setHeader("Content-Type", contentTypes[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Static server running at http://127.0.0.1:${port}/`);
});
