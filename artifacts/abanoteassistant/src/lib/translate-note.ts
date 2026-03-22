const MAX_CHUNK = 450;

function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= MAX_CHUNK) {
      chunks.push(para);
    } else {
      const sentences = para.split(/(?<=\. )/);
      let current = "";
      for (const s of sentences) {
        if ((current + s).length > MAX_CHUNK && current) {
          chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks.filter((c) => c.trim().length > 0);
}

async function translateChunk(
  text: string,
  from: string,
  to: string
): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
  const json = await res.json();
  const translated: string =
    json?.responseData?.translatedText ?? text;
  return translated;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function translateNote(
  text: string,
  targetLang: "es" | "en"
): Promise<string> {
  const from = targetLang === "es" ? "en" : "es";
  const chunks = splitIntoChunks(text);
  const translated: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(150);
    const result = await translateChunk(chunks[i], from, targetLang);
    translated.push(result);
  }

  return translated.join("\n\n");
}
