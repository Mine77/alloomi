/**
 * Database adapter unified entry point
 * Automatically selects PostgreSQL or SQLite based on deployment mode
 */

import type { DrizzleDB } from "../types";
import {
  initPostgresDb,
  getPostgresDb,
  closePostgresDb,
  isPostgresDbInitialized,
} from "./postgres";
import {
  initSqliteDb,
  getSqliteDb,
  closeSqliteDb,
  isSqliteDbInitialized,
  runSqliteMigrations,
} from "./sqlite";
import { getDatabaseUrl, TAURI_DB_PATH, isTauriMode } from "@/lib/env";

/**
 * Initialize database connection (automatically selects based on deployment mode)
 */
export function initDb(): DrizzleDB {
  if (isTauriMode()) {
    return initSqliteDb(TAURI_DB_PATH);
  }
  return initPostgresDb(getDatabaseUrl());
}

/**
 * Get database instance
 */
export function getDb(): DrizzleDB {
  if (isTauriMode()) {
    return getSqliteDb();
  }
  return getPostgresDb();
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (isTauriMode()) {
    closeSqliteDb();
  } else {
    await closePostgresDb();
  }
}

/**
 * Check if database is initialized
 */
export function isDbInitialized(): boolean {
  if (isTauriMode()) {
    return isSqliteDbInitialized();
  }
  return isPostgresDbInitialized();
}

/**
 * Run database migrations
 */
export async function runMigrations(migrationsFolder: string): Promise<void> {
  if (isTauriMode()) {
    await runSqliteMigrations(TAURI_DB_PATH, migrationsFolder);
  } else {
    // PostgreSQL migrations use drizzle-kit
    console.log("ℹ️ PostgreSQL migrations should be run via: pnpm db:migrate");
  }
}

// Export types
export type { DrizzleDB } from "../types";
