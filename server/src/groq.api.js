
import fs from "node:fs";
import OpenAI from "openai";

const endpoint = "https://chat-sci.services.ai.azure.com/openai/v1";
const deploymentName = "gpt-4.1-mini";

const openai = new OpenAI({
  baseURL: endpoint,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
});

const max_tokens = 2048;
const temperature = 0.5;

export const error_message =
  "Przepraszamy, podczas generowania podsumowania AI wystąpił błąd";

export async function summarise(inputData, language = "pl") {
  try {
    const SystemPrompt = fs.readFileSync(
      new URL("./system_prompt_" + language + ".txt", import.meta.url),
      "utf8"
    );

    const response = await openai.chat.completions.create({
      model: deploymentName,
      messages: [
        {
          role: "system",
          content: SystemPrompt,
        },
        {
          role: "user",
          content: String(inputData),
        },
      ],
      temperature,
      max_tokens,
    });

    const summary = response.choices?.[0]?.message?.content;

    if (!summary) {
      console.error("Azure OpenAI returned an empty response:", response);
      return error_message;
    }

    return summary;

  } catch (error) {
    console.error("Azure OpenAI Error:", error.message);
    return error_message;
  }
}
