export function deriveBlobPathFromUrl(source?: string | null): string | null {
  if (!source) return null;
  try {
    const parsed = new URL(source);
    if (!parsed.hostname.includes("vercel-storage.com")) {
      return null;
    }
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}
