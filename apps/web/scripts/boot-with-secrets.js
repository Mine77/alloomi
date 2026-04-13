#!/usr/bin/env node
// Read secrets JSON from stdin, set environment variables, then execute the original server.js

import { spawn } from "node:child_process";

let secretsData = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  secretsData += chunk;
});

process.stdin.on("end", () => {
  if (secretsData.trim()) {
    try {
      const secrets = JSON.parse(secretsData);
      Object.entries(secrets).forEach(([key, value]) => {
        if (value) process.env[key] = value;
      });
      console.log("✅ Loaded secrets from stdin");
    } catch (e) {
      console.error("❌ Failed to parse secrets:", e.message);
    }
  }

  // Execute the original Next.js server.js (last argument)
  const serverScript = process.argv[process.argv.length - 1];
  const child = spawn("node", [serverScript], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
});
