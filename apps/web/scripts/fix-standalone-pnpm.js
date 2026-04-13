import fs from "node:fs";
import path from "node:path";

const standaloneRoot = ".next/standalone";
const standaloneNode = `${standaloneRoot}/apps/web/node_modules`;
const standaloneApp = `${standaloneRoot}/apps/web`;

console.log("[FIX] Fixing pnpm modules for standalone mode...");

const mkdir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

mkdir(standaloneNode);
mkdir(`${standaloneApp}/.next`);

const copyDirRec = (src, dest) => {
  if (!fs.existsSync(src)) return;
  if (fs.statSync(src).isDirectory()) {
    mkdir(dest);
    for (const item of fs.readdirSync(src)) {
      copyDirRec(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

if (fs.existsSync(".next/static")) {
  console.log("[COPY] Copying static files...");
  if (fs.existsSync(`${standaloneApp}/.next/static`)) {
    fs.rmSync(`${standaloneApp}/.next/static`, { recursive: true });
  }
  copyDirRec(".next/static", `${standaloneApp}/.next/static`);
}

for (const item of ["chunks", "css", "server/chunks"]) {
  if (fs.existsSync(`.next/${item}`)) {
    if (fs.existsSync(`${standaloneApp}/.next/${item}`)) {
      fs.rmSync(`${standaloneApp}/.next/${item}`, { recursive: true });
    }
    copyDirRec(`.next/${item}`, `${standaloneApp}/.next/${item}`);
  }
}

if (fs.existsSync("public")) {
  console.log("[COPY] Copying public files...");
  if (fs.existsSync(`${standaloneApp}/public`)) {
    fs.rmSync(`${standaloneApp}/public`, { recursive: true });
  }
  copyDirRec("public", `${standaloneApp}/public`);
}

for (const item of [
  "BUILD_ID",
  "build-manifest.json",
  "prerender-manifest.json",
  "routes-manifest.json",
]) {
  if (fs.existsSync(`.next/${item}`)) {
    fs.copyFileSync(`.next/${item}`, `${standaloneApp}/.next/${item}`);
  }
}

if (fs.existsSync("scripts/boot-with-secrets.js")) {
  console.log("[COPY] Copying boot-with-secrets.js...");
  mkdir(`${standaloneApp}/scripts`);
  fs.copyFileSync(
    "scripts/boot-with-secrets.js",
    `${standaloneApp}/scripts/boot-with-secrets.js`,
  );
}

if (fs.existsSync("lib/db/migrations-sqlite")) {
  console.log("[COPY] Copying migrations-sqlite...");
  mkdir(`${standaloneApp}/lib/db`);
  copyDirRec(
    "lib/db/migrations-sqlite",
    `${standaloneApp}/lib/db/migrations-sqlite`,
  );
}

// Explicitly copy lib/, config/, cli-bundle/ — Windows bundler glob
// ../.next/standalone/**/* does not reliably match these on Windows
for (const item of ["lib", "config", "cli-bundle"]) {
  if (fs.existsSync(item)) {
    console.log(`[COPY] Copying ${item}...`);
    mkdir(`${standaloneApp}/${item}`);
    copyDirRec(item, `${standaloneApp}/${item}`);
  }
}

if (fs.existsSync(`${standaloneApp}/.wwebjs_auth`)) {
  console.log("[CLEAN] Cleaning up WhatsApp Web JS auth cache...");
  fs.rmSync(`${standaloneApp}/.wwebjs_auth`, { recursive: true });
}

console.log("[PATCH] Patching server.js to extend HTTP timeouts...");
const serverJsPath = `${standaloneApp}/server.js`;
if (fs.existsSync(serverJsPath)) {
  let content = fs.readFileSync(serverJsPath, "utf8");
  content = content.replace(
    /\}\)\.catch\(\(err\) => \{/,
    "}).then((server) => { server.timeout = 600000; server.headersTimeout = 600000; }).catch((err) => {",
  );
  fs.writeFileSync(serverJsPath, content);
}

console.log("[OK] Standalone pnpm modules fixed!");
