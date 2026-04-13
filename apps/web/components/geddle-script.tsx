"use client";

import Script from "next/script";
import { isTauriMode } from "@/lib/env/client-mode";

export function GeddleScript() {
  // Geddle script is not loaded in Tauri local version
  if (isTauriMode()) {
    return null;
  }

  return (
    <Script
      async
      src="https://geddle.com/sdk/latest.js"
      data-product-id="prod_ILWWzNbnfQS5nt"
      data-cookie-duration="60"
      strategy="afterInteractive"
    />
  );
}
