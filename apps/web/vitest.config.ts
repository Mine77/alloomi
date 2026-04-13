// vite.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: [
      // Specific paths first (higher priority)
      {
        find: "@alloomi/shared/errors",
        replacement: alias("../../packages/shared/src/errors.ts"),
      },
      {
        find: "@alloomi/security/token-encryption",
        replacement: alias("../../packages/security/src/token-encryption.ts"),
      },
      {
        find: "@alloomi/security/url-validator",
        replacement: alias("../../packages/security/src/url-validator.ts"),
      },
      {
        find: "@alloomi/billing/entitlements",
        replacement: alias("../../packages/billing/src/entitlements.ts"),
      },
      // agent subpaths - must be before the shorter @alloomi/agent alias
      {
        find: "@alloomi/agent/types",
        replacement: alias("../../packages/agent/src/types.ts"),
      },
      {
        find: "@alloomi/agent/registry",
        replacement: alias("../../packages/agent/src/registry.ts"),
      },
      {
        find: "@alloomi/agent/sandbox",
        replacement: alias("../../packages/agent/src/sandbox/index.ts"),
      },
      {
        find: "@alloomi/agent/plugin",
        replacement: alias("../../packages/agent/src/plugin.ts"),
      },
      {
        find: "@alloomi/agent/base",
        replacement: alias("../../packages/agent/src/base.ts"),
      },
      // agent/ai subpaths - must be before the shorter @alloomi/agent/ai alias
      {
        find: "@alloomi/agent/ai/request-context",
        replacement: alias("../../packages/agent/src/ai/request-context.ts"),
      },
      {
        find: "@alloomi/agent/ai/providers",
        replacement: alias("../../packages/agent/src/ai/providers.ts"),
      },
      {
        find: "@alloomi/agent/ai/router",
        replacement: alias("../../packages/agent/src/ai/router.ts"),
      },
      {
        find: "@alloomi/agent/ai",
        replacement: alias("../../packages/agent/src/ai/index.ts"),
      },
      // @alloomi/ai is a TypeScript path alias for @alloomi/agent/ai
      {
        find: "@alloomi/ai",
        replacement: alias("../../packages/agent/src/ai/index.ts"),
      },
      {
        find: "@alloomi/ai/*",
        replacement: alias("../../packages/agent/src/ai/*"),
      },
      {
        find: "@alloomi/integrations/channels/sources/types",
        replacement: alias(
          "../../packages/integrations/channels/src/sources/types.ts",
        ),
      },
      // Package roots
      {
        find: "@alloomi/mcp",
        replacement: alias("../../packages/mcp/src/index.ts"),
      },
      // rag subpaths - must be before the shorter @alloomi/rag alias
      {
        find: "@alloomi/rag/universal-embeddings",
        replacement: alias("../../packages/rag/src/universal-embeddings.ts"),
      },
      {
        find: "@alloomi/rag/*",
        replacement: alias("../../packages/rag/src/*"),
      },
      {
        find: "@alloomi/rag",
        replacement: alias("../../packages/rag/src/index.ts"),
      },
      // i18n subpaths - must be before the shorter @alloomi/i18n alias
      {
        find: "@alloomi/i18n/locales",
        replacement: alias("../../packages/i18n/src/locales"),
      },
      {
        find: "@alloomi/i18n/*",
        replacement: alias("../../packages/i18n/src/*"),
      },
      {
        find: "@alloomi/i18n",
        replacement: alias("../../packages/i18n/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/calendar",
        replacement: alias("../../packages/integrations/calendar/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/calendar/*",
        replacement: alias("../../packages/integrations/calendar/src/*"),
      },
      {
        find: "@alloomi/integrations/hubspot",
        replacement: alias("../../packages/integrations/hubspot/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/hubspot/*",
        replacement: alias("../../packages/integrations/hubspot/src/*"),
      },
      {
        find: "@alloomi/indexeddb/extractor",
        replacement: alias("../../packages/indexeddb/src/extractor.ts"),
      },
      {
        find: "@alloomi/indexeddb/*",
        replacement: alias("../../packages/indexeddb/src/*"),
      },
      {
        find: "@alloomi/indexeddb",
        replacement: alias("../../packages/indexeddb/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/imessage",
        replacement: alias("../../packages/integrations/imessage/src/index.ts"),
      },
      {
        find: "@alloomi/shared",
        replacement: alias("../../packages/shared/src/index.ts"),
      },
      {
        find: "@alloomi/security",
        replacement: alias("../../packages/security/src/index.ts"),
      },
      {
        find: "@alloomi/billing",
        replacement: alias("../../packages/billing/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/channels",
        replacement: alias("../../packages/integrations/channels/src/index.ts"),
      },
      {
        find: "@alloomi/agent",
        replacement: alias("../../packages/agent/src/index.ts"),
      },
      {
        find: "@alloomi/insights",
        replacement: alias("../../packages/insights/src/index.ts"),
      },
      {
        find: "@alloomi/rss",
        replacement: alias("../../packages/rss/src/index.ts"),
      },
      { find: "@", replacement: alias(".") },
    ],
  },
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    include: [
      "tests/unit/*.test.ts",
      "tests/api/*.test.ts",
      "tests/api/*.smoke.ts",
      "tests/benchmark/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "out"],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage/unit",
    },
  },
});
