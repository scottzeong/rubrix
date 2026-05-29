const stateId = "default";

function supabaseHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  };
}

function requireSupabaseConfig(response) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    response.status(500).json({
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.",
    });
    return false;
  }

  return true;
}

function supabaseEndpoint() {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  return `${baseUrl}/rest/v1/app_state`;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Supabase 저장소 응답 시간이 초과되었습니다.")), timeoutMs)
    ),
  ]);
}

export default async function handler(request, response) {
  if (!requireSupabaseConfig(response)) return;

  const endpoint = supabaseEndpoint();

  if (request.method === "GET") {
    try {
      const supabaseResponse = await fetchWithTimeout(`${endpoint}?id=eq.${stateId}&select=data`, {
        headers: supabaseHeaders(),
      });
      const payload = await supabaseResponse.json();

      if (!supabaseResponse.ok) {
        response.status(supabaseResponse.status).json({
          error: payload.message || "Failed to load app state.",
        });
        return;
      }

      response.status(200).json({
        data: payload[0]?.data ?? null,
      });
      return;
    } catch (error) {
      response.setHeader("Cache-Control", "no-store");
      response.status(504).json({
        error: error instanceof Error ? error.message : "Failed to load app state.",
      });
    }
    return;
  }

  if (request.method === "POST") {
    const data = request.body?.data;

    if (!data || typeof data !== "object") {
      response.status(400).json({ error: "data object is required." });
      return;
    }

    try {
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
        response.status(supabaseResponse.status).json({
          error: payload.message || "Failed to save app state.",
        });
        return;
      }

      response.status(200).json({
        data: payload[0]?.data ?? data,
      });
      return;
    } catch (error) {
      response.setHeader("Cache-Control", "no-store");
      response.status(504).json({
        error: error instanceof Error ? error.message : "Failed to save app state.",
      });
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  response.status(405).json({ error: "Method not allowed." });
}
