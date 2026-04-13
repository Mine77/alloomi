/**
 * Cloud Authentication Integration Tests
 * Tests the complete authentication flow
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Mock cloud server
let mockServer: ReturnType<typeof createServer>;
let serverUrl: string;

beforeAll(async () => {
  // Create mock server
  mockServer = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/remote-auth/login") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const data = JSON.parse(body);

        // Simulate login
        if (data.email === "test@example.com" && data.password === "password") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              user: {
                id: "user_123",
                email: "test@example.com",
                name: "Test User",
                avatarUrl: null,
              },
              token: generateMockToken("user_123", "test@example.com"),
            }),
          );
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid credentials" }));
        }
      });
    } else if (
      req.method === "POST" &&
      req.url === "/api/remote-auth/register"
    ) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const data = JSON.parse(body);

        // Simulate registration
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            user: {
              id: "user_456",
              email: data.email,
              name: data.email.split("@")[0],
              avatarUrl: null,
            },
            token: generateMockToken("user_456", data.email),
          }),
        );
      });
    } else if (
      req.method === "GET" &&
      req.url?.startsWith("/api/remote-auth/user")
    ) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);

        // Validate token
        const payload = parseMockToken(token);
        if (payload) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: payload.id,
              email: payload.email,
              name: "Test User",
              avatarUrl: null,
              subscription: "regular",
            }),
          );
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid token" }));
        }
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
      }
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, () => {
      const port = (mockServer.address() as AddressInfo).port;
      serverUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  mockServer.close();
});

// Simple token generation and parsing (for testing only)
function generateMockToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: userId,
    email,
    exp: now + 30 * 24 * 60 * 60,
    iat: now,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.mock_signature`;
}

function parseMockToken(token: string): { id: string; email: string } | null {
  try {
    const [encodedPayload] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    );
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

describe("Cloud Authentication Integration", () => {
  it("should login successfully with valid credentials", async () => {
    const response = await fetch(`${serverUrl}/api/remote-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password",
      }),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("test@example.com");
    expect(data.token).toBeDefined();
  });

  it("should fail login with invalid credentials", async () => {
    const response = await fetch(`${serverUrl}/api/remote-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "wrong_password",
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });

  it("should register new user", async () => {
    const response = await fetch(`${serverUrl}/api/remote-auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "newuser@example.com",
        password: "password123",
      }),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("newuser@example.com");
    expect(data.token).toBeDefined();
  });

  it("should get user info with valid token", async () => {
    // Login first to get token
    const loginResponse = await fetch(`${serverUrl}/api/remote-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password",
      }),
    });

    const loginData = await loginResponse.json();
    const token = loginData.token;

    // Use token to get user info
    const userResponse = await fetch(`${serverUrl}/api/remote-auth/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(userResponse.ok).toBe(true);

    const userData = await userResponse.json();

    expect(userData.id).toBeDefined();
    expect(userData.email).toBe("test@example.com");
  });

  it("should fail to get user info with invalid token", async () => {
    const response = await fetch(`${serverUrl}/api/remote-auth/user`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid_token",
      },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("should fail to get user info without token", async () => {
    const response = await fetch(`${serverUrl}/api/remote-auth/user`, {
      method: "GET",
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });
});

describe("Token Management Integration", () => {
  it("should store and retrieve token", () => {
    const mockStorage: { [key: string]: string } = {};

    // Mock localStorage
    global.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, value) => {
        mockStorage[key] = value;
      },
      removeItem: (key) => {
        delete mockStorage[key];
      },
      clear: () => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      },
      length: 0,
      key: () => null,
    };

    // Dynamically import token manager
    return import("../../lib/auth/token-manager").then((module) => {
      const token = "test_token";

      module.storeAuthToken(token);
      expect(mockStorage.cloud_auth_token).toBe(token);

      const retrieved = module.getAuthToken();
      expect(retrieved).toBe(token);
    });
  });
});
