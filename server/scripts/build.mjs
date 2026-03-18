import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(root, "../dist");

await mkdir(distDir, { recursive: true });
await cp(resolve(root, "../src"), resolve(distDir, "src"), { recursive: true, force: true });
