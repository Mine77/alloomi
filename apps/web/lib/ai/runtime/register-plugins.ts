/**
 * Plugin Registration
 *
 * Registers agent plugins. This module is loaded separately to avoid
 * circular dependency issues during module initialization.
 */

import { getAgentRegistry } from "@alloomi/agent/registry";
import { claudePlugin } from "@/lib/extensions";

// Register Claude Agent plugin
// This must be called AFTER all modules are loaded to avoid circular deps
export function registerPlugins() {
  getAgentRegistry().register(claudePlugin);
}
