import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({test: {fileParallelism: false, testTimeout: 20000, hookTimeout: 30000}, resolve: {alias: {"@": fileURLToPath(new URL("./src", import.meta.url))}}});
