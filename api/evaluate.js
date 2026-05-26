const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    total_score: { type: "number" },
    feedback: { type: "string" },
    student_report: { type: "string" },
  },
  required: ["total_score", "feedback", "student_report"],
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    response.status(500).json({
      error: "OPENAI_API_KEY environment variable is not set.",
    });
    return;
  }

  try {
    const { model = "gpt-5.4-mini", prompt } = request.body ?? {};

    if (!prompt || typeof prompt !== "string") {
      response.status(400).json({ error: "prompt is required." });
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
        text: {
          format: {
            type: "json_schema",
            name: "report_evaluation",
            strict: true,
            schema: evaluationSchema,
          },
        },
      }),
    });

    const apiPayload = await apiResponse.json();

    if (!apiResponse.ok) {
      response.status(apiResponse.status).json({
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
      response.status(502).json({ error: "OpenAI response did not include text output." });
      return;
    }

    response.status(200).json({
      result: JSON.parse(outputText),
      raw: apiPayload,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected evaluation error.",
    });
  }
}
