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

const re = /export const UploadClientAssessmentDocumentBody = zod\.object\(\{\s*file: zod\s*\.instanceof\((?:File|Blob)\)\s*\.describe\("[^"]*"\),\s*\}\);/s;

const replacement = `export const UploadClientAssessmentDocumentBody = zod.object({
  file: zod
    .unknown()
    .describe("Assessment PDF multipart field file (validated at HTTP layer)"),
});`;

if (!re.test(text)) {
  console.warn("patch-api-zod-generated: UploadClientAssessmentDocumentBody pattern not found; skip");
} else {
  text = text.replace(re, replacement);
  fs.writeFileSync(apiPath, text, "utf8");
  console.log("patched lib/api-zod/src/generated/api.ts (multipart body -> z.unknown())");
}
