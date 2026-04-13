/**
 * Inline CSS and JS resources from HTML
 * Converts <link href="style.css"> and <script src="app.js"> to inline content
 */
export async function inlineResources(
  html: string,
  fileDir: string,
  taskId?: string,
): Promise<string> {
  let processedHtml = html;

  // Extract and inline CSS
  const cssRegex = /<link\s+[^>]*?href=["']([^"']+\.css)["'][^>]*>/gi;
  const cssMatches = [...html.matchAll(cssRegex)];

  for (const match of cssMatches) {
    const [fullTag, cssPath] = match;
    // Skip remote URLs - they should be loaded as-is
    if (cssPath.startsWith("http://") || cssPath.startsWith("https://")) {
      continue;
    }
    const relativeCssPath = cssPath.startsWith("/")
      ? cssPath
      : `${fileDir}/${cssPath}`;

    try {
      let cssContent = "";
      const isTauri = !!(globalThis as any).__TAURI__;

      if (isTauri) {
        const { readFile } = await import("@/lib/tauri");
        const data = await readFile(relativeCssPath);
        cssContent = data || "";
      } else if (taskId) {
        // Read from API - handle relative paths
        let apiPath = relativeCssPath;
        // Add taskId if path doesn't contain it
        if (!relativeCssPath.includes(taskId)) {
          apiPath = `${taskId}/${relativeCssPath}`;
        }
        const response = await fetch(`/api/workspace/file/${apiPath}`);
        if (response.ok) {
          const data = await response.json();
          cssContent = data.content || "";
        }
      }

      if (cssContent) {
        const inlineCss = `<style>\n${cssContent}\n</style>`;
        processedHtml = processedHtml.replace(fullTag, inlineCss);
      }
    } catch (err) {
      console.error(
        `[WebsitePreview] Failed to inline CSS ${relativeCssPath}:`,
        err,
      );
    }
  }

  // Extract and inline JS
  const jsRegex = /<script\s+src=["']([^"']+\.js)["'][^>]*><\/script>/gi;
  const jsMatches = [...processedHtml.matchAll(jsRegex)];

  for (const match of jsMatches) {
    const [fullTag, jsPath] = match;
    // Skip remote URLs - they should be loaded as-is
    if (jsPath.startsWith("http://") || jsPath.startsWith("https://")) {
      continue;
    }
    const relativeJsPath = jsPath.startsWith("/")
      ? jsPath
      : `${fileDir}/${jsPath}`;

    try {
      let jsContent = "";
      const isTauri = !!(globalThis as any).__TAURI__;

      if (isTauri) {
        const { readFile } = await import("@/lib/tauri");
        const data = await readFile(relativeJsPath);
        jsContent = data || "";
      } else if (taskId) {
        // Read from API - handle relative paths
        let apiPath = relativeJsPath;
        // Add taskId if path doesn't contain it
        if (!relativeJsPath.includes(taskId)) {
          apiPath = `${taskId}/${relativeJsPath}`;
        }
        const response = await fetch(`/api/workspace/file/${apiPath}`);
        if (response.ok) {
          const data = await response.json();
          jsContent = data.content || "";
        }
      }

      if (jsContent) {
        const inlineJs = `<script>\n${jsContent}\n<\/script>`;
        processedHtml = processedHtml.replace(fullTag, inlineJs);
      }
    } catch (err) {
      console.error(
        `[WebsitePreview] Failed to inline JS ${relativeJsPath}:`,
        err,
      );
    }
  }

  return processedHtml;
}
