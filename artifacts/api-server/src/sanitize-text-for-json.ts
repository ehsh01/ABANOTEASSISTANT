/**
 * PostgreSQL `jsonb` text values reject U+0000 (null). PDF text extraction sometimes emits
 * null bytes; strip them (and lone surrogates) before persisting in `profile`.
 */
export function sanitizeTextForJsonStorage(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) continue;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i++;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    out += text[i];
  }
  return out;
}
