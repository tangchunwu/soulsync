import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

export async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
) {
  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 500,
  });
  return res.choices[0]?.message?.content || "";
}
