import { z } from "zod";
import {
  callStructured,
  NoCompliantProviderError,
} from "@/lib/llm/client";

const schema = z.object({
  ok: z.boolean(),
  detected_language: z.string(),
  note: z.string().optional(),
});

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log(
      "OPENROUTER_API_KEY is not set — skipping the live call. " +
        "The client is hardcoded to zdr=true + data_collection=deny and fails closed.",
    );
    return;
  }

  try {
    const result = await callStructured(
      schema,
      [
        {
          role: "system",
          content:
            'Reply with JSON only, exactly this shape: {"ok": boolean, "detected_language": string, "note": string}. Detect the language of the user message.',
        },
        { role: "user", content: "Ina son sanin ko labarin gaskiya ne?" },
      ],
      { stage: "check", promptVersion: "check-v1", maxTokens: 1500 },
    );
    console.log("Live call succeeded:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof NoCompliantProviderError) {
      console.log("FAIL-CLOSED (expected if no ZDR endpoint exists):");
      console.log(error.message);
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
