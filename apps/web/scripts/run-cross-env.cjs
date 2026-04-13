#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

/**
 * Parses environment variable assignments from command-line arguments and returns
 * the remaining command arguments. Supports KEY=value prefix arguments until the
 * first non-assignment argument is encountered.
 *
 * @param {string[]} argv - Raw argument array (excluding node and script name).
 * @returns {{ env: NodeJS.ProcessEnv; commandArgs: string[] }} Parsed environment variables and command arguments.
 */
function parseArgs(argv) {
  const env = { ...process.env };
  let index = 0;

  while (index < argv.length) {
    const token = argv[index];
    const equalsIndex = token.indexOf("=");
    const isAssignment = equalsIndex > 0;

    if (!isAssignment) {
      break;
    }

    const key = token.slice(0, equalsIndex);
    const value = token.slice(equalsIndex + 1);
    env[key] = value;
    index += 1;
  }

  return {
    env,
    commandArgs: argv.slice(index),
  };
}

/**
 * Resolves the executable command and arguments, preferring stable paths for the
 * next CLI. Falls back to the next installation in the repo root when local
 * node_modules links are broken.
 *
 * @param {string[]} commandArgs - Raw command and arguments.
 * @returns {{ command: string; args: string[] }} Resolved executable command and arguments.
 */
function resolveCommand(commandArgs) {
  const [command, ...args] = commandArgs;

  if (command !== "next") {
    return { command, args };
  }

  try {
    const nextBin = require.resolve("next/dist/bin/next", {
      paths: [process.cwd(), path.resolve(process.cwd(), "../..")],
    });
    return { command: process.execPath, args: [nextBin, ...args] };
  } catch {
    return { command, args };
  }
}

/**
 * Spawns a child process to execute the target command and forwards the exit code.
 * Enables shell mode on Windows to support .cmd wrapper commands like next/pnpm.
 */
function main() {
  const { env, commandArgs } = parseArgs(process.argv.slice(2));

  if (commandArgs.length === 0) {
    console.error(
      "Usage: node ./scripts/run-cross-env.cjs KEY=value ... <command> [args...]",
    );
    process.exit(1);
  }

  const resolved = resolveCommand(commandArgs);
  const child = spawn(resolved.command, resolved.args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32" && resolved.command !== process.execPath,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
