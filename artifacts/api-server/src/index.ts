import "./load-local-env";
import app from "./app";
import { isOpenAINoteGenerationConfigured } from "./openai-notes";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  if (isOpenAINoteGenerationConfigured()) {
    console.log("[notes] OpenAI clinical narrative: enabled (OPENAI_API_KEY is set)");
  } else {
    console.warn(
      "[notes] OPENAI_API_KEY is missing — POST /notes/generate will return 503 until set in artifacts/api-server/.env (then restart the API).",
    );
  }
});
