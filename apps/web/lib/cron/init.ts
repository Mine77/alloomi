/**
 * Initialize all custom job handlers
 * Call this function when application starts
 */
export function initializeCustomJobHandlers() {
  // You can add more custom handlers here
  // registerCustomHandler("my_custom_handler", myCustomHandler);

  console.log("[Cron] Custom job handlers initialized");
}

// Auto-initialize (if module is loaded)
if (typeof window === "undefined") {
  // Only run on server side
  initializeCustomJobHandlers();
}
