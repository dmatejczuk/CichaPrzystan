import fs from "node:fs";

const model = "openai/gpt-oss-20b";
const max_tokens = 2048;
const temperature = 0.5;

export const error_message =
  "Przepraszamy, podczas generowania podsumowania AI wystąpił błąd";



export async function summarise(inputData, language="pl") {
  try {

    let SystemPrompt = fs.readFileSync(
    new URL("./system_prompt_" + (language) +".txt", import.meta.url),
    "utf8"
);


    const messages = [
      {
        role: "system",
        content: SystemPrompt 
      },
      {
        role: "user",
        content: String(inputData)
      }
    ];


    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Groq API Error:", result);

      return error_message;
    }

    const summary = result.choices?.[0]?.message?.content;

    if (!summary) {
      console.error("Groq returned an empty response:", result);
      return error_message;
    }

    return summary;

  } catch (error) {
    console.error("Summarise Error:", error.message);
    return error_message;
  }
}
