/**
 * Initialize SQLite database (for pre-migration preparation)
 */
import { chdir, cwd } from "node:process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAppDataDir, joinPath } from "@/lib/utils/path";

// Switch to web directory to ensure migrations folder is found
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webDir = dirname(__dirname); // apps/web
chdir(webDir);

console.log(`Working directory: ${cwd()}`);

// Use environment variable or default path
const DB_PATH =
  process.env.TAURI_DB_PATH || joinPath(getAppDataDir(), "data.db");

console.log(`Database path: ${DB_PATH}`);
console.log("Initializing SQLite database...");
const { initSqliteDb } = await import("./adapters/sqlite.js");
initSqliteDb(DB_PATH);
console.log("✅ Database initialized!");
