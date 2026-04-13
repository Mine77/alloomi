/**
 * SQLite database initialization API
 * Used to initialize database schema in Tauri environment
 */

import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { isTauriMode, TAURI_DB_PATH } from "@/lib/env";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";

export async function POST() {
  try {
    // Check if database file exists
    const dbExists = existsSync(TAURI_DB_PATH);

    if (dbExists) {
      // Check if User table exists
      const sqlite = new Database(TAURI_DB_PATH);
      const tableExists = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
        )
        .get();
      sqlite.close();

      if (tableExists) {
        return NextResponse.json({
          success: true,
          message: "Database already initialized",
          alreadyExists: true,
        });
      }
    }

    console.log("🔄 Initializing SQLite database schema...");

    // Create custom drizzle config for SQLite
    // Note: Must use schema-sqlite.ts instead of schema.ts to avoid selecting wrong schema in different environments
    const drizzleConfig = {
      schema: "./lib/db/schema-sqlite.ts",
      out: "./lib/db/migrations-sqlite",
      dialect: "sqlite" as const,
      driver: "better-sqlite" as const,
      dbCredentials: {
        url: TAURI_DB_PATH,
      },
    };

    // Write config to temporary file
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");

    const tempDir = os.tmpdir();
    const configFile = path.join(tempDir, "drizzle.sqlite.config.json");

    fs.writeFileSync(configFile, JSON.stringify(drizzleConfig, null, 2));

    try {
      // Run drizzle-kit push and specify config file
      execSync(`npx drizzle-kit push --config="${configFile}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } finally {
      // Clean up temporary file
      fs.unlinkSync(configFile);
    }

    return NextResponse.json({
      success: true,
      message: "SQLite database initialized successfully",
      dbPath: TAURI_DB_PATH,
    });
  } catch (error) {
    console.error("❌ Failed to initialize SQLite database:", error);
    return NextResponse.json(
      {
        error: "Failed to initialize database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  // Return initialization status
  const dbExists = existsSync(TAURI_DB_PATH);
  let tablesExist = false;

  if (dbExists) {
    try {
      const sqlite = new Database(TAURI_DB_PATH);
      const tableExists = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
        )
        .get();
      sqlite.close();
      tablesExist = !!tableExists;
    } catch (error) {
      console.error("Failed to check database:", error);
    }
  }

  return NextResponse.json({
    mode: isTauriMode() ? "tauri" : "server",
    dbPath: TAURI_DB_PATH,
    dbExists,
    tablesExist,
    message: tablesExist
      ? "Database is initialized"
      : "Use POST to initialize SQLite database",
  });
}
