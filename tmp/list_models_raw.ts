import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.error("GOOGLE_AI_API_KEY not found in .env.local");
  process.exit(1);
}

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.error) {
      console.error("API Error:", data.error);
    } else {
      console.log("Available Models:");
      data.models?.forEach((m: any) => {
        console.log(`- ${m.name} (${m.displayName}) methods: ${m.supportedGenerationMethods?.join(", ")}`);
      });
    }
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

listModels();
