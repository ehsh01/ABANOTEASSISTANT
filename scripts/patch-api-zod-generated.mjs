/**
 * Orval zod client emits `z.instanceof(File|Blob)` for multipart bodies; Node `tsc` with lib es2022
 * has no global File/Blob types. Use z.unknown() — multipart is validated by multer on the server.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiPath = path.join(root, "lib", "api-zod", "src", "generated", "api.ts");
let text = fs.readFileSync(apiPath, "utf8");

const re = /zod\s*\.instanceof\((?:File|Blob)\)/g;
const matches = text.match(re);

if (!matches) {
  console.warn("patch-api-zod-generated: multipart File/Blob patterns not found; skip");
} else {
  text = text.replace(re, "zod.unknown()");
  fs.writeFileSync(apiPath, text, "utf8");
  console.log(
    `patched lib/api-zod/src/generated/api.ts (${matches.length} multipart File/Blob fields -> z.unknown())`,
  );
}
