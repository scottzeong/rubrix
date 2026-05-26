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

export default async function handler(request, response) {
  if (!requireSupabaseConfig(response)) return;

  const endpoint = `${process.env.SUPABASE_URL}/rest/v1/app_state`;

  if (request.method === "GET") {
    const supabaseResponse = await fetch(`${endpoint}?id=eq.${stateId}&select=data`, {
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
  }

  if (request.method === "POST") {
    const data = request.body?.data;

    if (!data || typeof data !== "object") {
      response.status(400).json({ error: "data object is required." });
      return;
    }

    const supabaseResponse = await fetch(`${endpoint}?on_conflict=id`, {
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
  }

  response.setHeader("Allow", "GET, POST");
  response.status(405).json({ error: "Method not allowed." });
}
