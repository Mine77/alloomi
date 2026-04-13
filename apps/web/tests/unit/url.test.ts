import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockIsTauriMode = vi.fn(() => false);
vi.mock("@/lib/env", () => ({
  isTauriMode: () => mockIsTauriMode(),
  getAppUrl: vi.fn(() => "http://localhost:3415"),
}));

import { getApplicationBaseUrl } from "@/lib/url";

const originalEnv = { ...process.env };

describe("getApplicationBaseUrl", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    mockIsTauriMode.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers public app url and trims trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    expect(getApplicationBaseUrl()).toBe("https://example.com");
  });

  it("falls back to vercel url when provided", () => {
    process.env.NEXT_PUBLIC_APP_URL = undefined;
    process.env.VERCEL_URL = "my-app.vercel.app/";
    expect(getApplicationBaseUrl()).toBe("https://my-app.vercel.app");
  });

  it("returns localhost when no env provided", () => {
    process.env.NEXT_PUBLIC_APP_URL = undefined;
    process.env.APP_URL = undefined;
    process.env.APPLICATION_URL = undefined;
    process.env.NEXTAUTH_URL = undefined;
    process.env.VERCEL_URL = undefined;
    expect(getApplicationBaseUrl()).toBe("http://localhost:3415");
  });
});
