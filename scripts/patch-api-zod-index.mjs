/**
 * Orval's zod client can emit an index.ts that re-exports non-existent paths when TS
 * schemas are disabled. Normalize to a single export surface for @workspace/api-zod.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "lib", "api-zod", "src", "index.ts");
fs.writeFileSync(indexPath, 'export * from "./generated/api";\n', "utf8");
console.log("patched lib/api-zod/src/index.ts");
