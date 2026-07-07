import OpenAI from "openai";

let aiClient: OpenAI | null = null;

function getAIClient(): OpenAI {
  if (!aiClient) {
    aiClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "test-key",
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return aiClient;
}

export async function summarizeAnomalies(findings: string[]): Promise<string> {
  if (findings.length === 0) {
    return "No anomalies detected in this daily report.";
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return `Found ${findings.length} anomaly issue(s). Manual review required.`;
    }

    const prompt = `Summarize the following parking revenue anomalies in plain language for an operator. Be concise and actionable:
${findings.map((f) => `- ${f}`).join("\n")}

Provide a 2-3 sentence summary that explains what went wrong and why it matters.`;

    const ai = getAIClient();
    const response = await ai.chat.completions.create({
      model: "anthropic/claude-haiku",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0].message.content || "Unable to generate summary";
  } catch (error) {
    return `Found ${findings.length} anomaly issue(s). Manual review required.`;
  }
}

export async function parseAnomalyJSON(jsonStr: string): Promise<{
  reasons: string[];
  anomaly_ok: boolean;
}> {
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      anomaly_ok: typeof parsed.anomaly_ok === "boolean" ? parsed.anomaly_ok : true,
    };
  } catch {
    return {
      reasons: ["Failed to parse anomaly response"],
      anomaly_ok: false,
    };
  }
}
