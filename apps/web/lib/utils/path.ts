/**
 * Cross-platform path utility module
 *
 * Provides cross-platform compatible path processing functionality, supports Windows, Linux, macOS
 * Note: This module is only available in Node.js environment, not applicable to browser environment
 */

import "server-only";

/**
 * Get user home directory (cross-platform)
 * Use Node.js built-in os.homedir() to ensure cross-platform compatibility
 * Note: This function is only available in Node.js environment
 */
export function getHomeDir(): string {
  const { homedir } = require("node:os");
  return homedir();
}

/**
 * Path joining (using platform separator)
 * @param paths Path segments
 */
export function joinPath(...paths: string[]): string {
  const { join } = require("node:path");
  return join(...paths);
}

/**
 * Get application data directory (cross-platform)
 * Consistent with Rust side get_data_dir():
 * - Unix: ~/.alloomi
 * - Windows: %USERPROFILE%\.alloomi or %APPDATA%\Alloomi
 *
 * Note: This function is only available in Node.js environment
 */
export function getAppDataDir(): string {
  const { homedir } = require("node:os");
  const { join } = require("node:path");
  const home = homedir();

  if (process.platform === "win32") {
    // Windows: prioritize USERPROFILE, then APPDATA
    const userprofile = process.env.USERPROFILE;
    if (userprofile) {
      return join(userprofile, ".alloomi");
    }
    return join(process.env.APPDATA || home, "Alloomi");
  }

  // Unix (Linux/macOS): ~/.alloomi
  return join(home, ".alloomi");
}

/**
 * Get subdirectories under application data directory (cross-platform)
 * @param subDirs Subdirectory paths
 */
export function getAppDataSubPath(...subDirs: string[]): string {
  return joinPath(getAppDataDir(), ...subDirs);
}

/**
 * Get database file path
 * Default path: <appDataDir>/data.db
 */
export function getDatabasePath(): string {
  return getAppDataSubPath("data.db");
}

/**
 * Get the memory directory path for conversation stores.
 * Path: <appDataDir>/data/memory/
 */
export function getAppMemoryDir(): string {
  return getAppDataSubPath("data", "memory");
}

/**
 * Get memory file system path
 * Default path: <appDataDir>/data/memory
 */
export function getMemoryPath(): string {
  return getAppDataSubPath("data", "memory");
}

/**
 * Get storage directory path
 * Default path: <appDataDir>/storage
 */
export function getStoragePath(): string {
  return getAppDataSubPath("storage");
}

/**
 * Get logs directory path
 * Default path: <appDataDir>/logs
 */
export function getLogsPath(): string {
  return getAppDataSubPath("logs");
}
