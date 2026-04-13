import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "use-local-storage": "src/use-local-storage.ts",
    "use-local-sync": "src/use-local-sync.ts",
    "use-is-mobile": "src/use-is-mobile.ts",
    "use-on-click-outside": "src/use-on-click-outside.ts",
    "use-custom-event": "src/use-custom-event.ts",
    "use-mobile-bottom-spacing": "src/use-mobile-bottom-spacing.ts",
    "use-enter-send-ime": "src/use-enter-send-ime.ts",
    "use-pull-to-refresh": "src/use-pull-to-refresh.tsx",
    "use-scroll-to-bottom": "src/use-scroll-to-bottom.tsx",
  },
  dts: true,
  format: ["esm", "cjs"],
  splitting: false,
  clean: true,
});
