"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";
import {
  AvatarDisplay,
  getAvatarConfigByState,
  AvatarState,
} from "@/components/agent-avatar";

/**
 * App Status type
 */
type AppStatusState = "starting" | "downloading" | "running" | "error";

/**
 * Server status payload from backend
 */
interface ServerStatusPayload {
  running: boolean;
  status: string;
  error_message: string | null;
  node_version: string | null;
}

/**
 * Minimum time (ms) to show the startup screen, even if server is already ready.
 * This ensures users always see the startup animation on cold start.
 */
const MIN_SHOW_DURATION = 800;

/**
 * Startup screen component
 * Displays a friendly loading UI while the app is starting up.
 *
 * Always renders immediately in Tauri production — no `mounted` guard that
 * delays the first paint, so the startup screen appears before React hydrates.
 */
export function AppStartupScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AppStatusState>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showScreen, setShowScreen] = useState(() => {
    // On first render (SSR + initial client), always show the screen.
    // Only in browser/ dev mode skip it immediately.
    if (typeof window === "undefined" || !isTauri()) return false;
    return true;
  });

  // Minimum display timer — ensures the screen stays visible for at least MIN_SHOW_DURATION
  const [minTimerDone, setMinTimerDone] = useState(false);

  useEffect(() => {
    // In non-Tauri environment, immediately hide
    if (!isTauri()) {
      setShowScreen(false);
      setStatus("running");
      return;
    }

    let unlisten: (() => void) | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    // Sync local state from ServerStatusPayload
    const applyStatus = (payload: ServerStatusPayload) => {
      if (payload.running) {
        setStatus("running");
      } else if (payload.status === "crashed") {
        setStatus("error");
        setErrorMessage(payload.error_message || "Server crashed");
        // Auto-trigger restart
        invoke("restart_server")
          .then(() => {
            setStatus("starting");
          })
          .catch(() => {
            // restart failed, keep showing error
          });
      } else if (payload.status === "error") {
        setStatus("error");
        setErrorMessage(payload.error_message);
      } else if (payload.status === "downloading") {
        setStatus("downloading");
      } else {
        setStatus("starting");
      }
    };

    // Fallback: poll getServerStatus if no event arrives within 3s
    const startPolling = () => {
      pollInterval = setInterval(async () => {
        try {
          const result = await invoke<ServerStatusPayload>("get_server_status");
          applyStatus(result);
        } catch {
          // ignore
        }
      }, 3000);
    };

    // Start polling after 3s timeout
    pollTimeout = setTimeout(startPolling, 3000);

    // Listen for server-status events from backend
    listen<ServerStatusPayload>("server-status", (event) => {
      applyStatus(event.payload);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // Fall back to polling immediately
        startPolling();
      });

    // Always enforce minimum display duration, even if backend is ready fast
    const minTimer = setTimeout(() => {
      setMinTimerDone(true);
    }, MIN_SHOW_DURATION);

    return () => {
      if (unlisten) unlisten();
      if (pollInterval) clearInterval(pollInterval);
      if (pollTimeout) clearTimeout(pollTimeout);
      clearTimeout(minTimer);
    };
  }, []);

  // Hide the startup screen once backend is running AND minimum display time has passed.
  const isReady = status === "running" && minTimerDone;
  if (!showScreen || isReady) {
    return null;
  }

  // Get corresponding Avatar state
  const getAvatarState = (): AvatarState => {
    switch (status) {
      case "starting":
      case "downloading":
        return AvatarState.REFRESHING;
      case "error":
        return AvatarState.DEFAULT;
      default:
        return AvatarState.DEFAULT;
    }
  };

  const avatarConfig = getAvatarConfigByState(getAvatarState());

  // Render status description
  const getStatusDescription = () => {
    switch (status) {
      case "starting":
        return t("toast.appStarting");
      case "downloading":
        return t("toast.appDownloading");
      case "error":
        // Show the main error line (before the "|" separator), or the full message if no separator
        return errorMessage?.split("|")[0]?.trim() || t("common.error");
      default:
        return "";
    }
  };

  const handleRetry = async () => {
    setIsRestarting(true);
    setErrorMessage(null);
    setStatus("starting");
    try {
      await invoke("restart_server");
    } catch {
      // If restart fails, show error
      setStatus("error");
      setErrorMessage(t("common.error"));
      setIsRestarting(false);
    }
  };

  return (
    <div
      suppressHydrationWarning
      className="fixed inset-0 flex flex-col items-center justify-center bg-background z-[9999]"
    >
      {/* Avatar */}
      <div className="mb-6">
        <AvatarDisplay
          config={avatarConfig}
          className="w-[120px] h-[120px]"
          enableInteractions={false}
        />
      </div>

      {/* Status description */}
      {status === "error" && errorMessage?.includes("Download Node.js:") ? (
        <div className="text-sm text-muted-foreground text-center max-w-[360px]">
          <p className="mb-1">{errorMessage.split("|")[0]?.trim()}</p>
          {errorMessage.includes("|") && (
            <p className="mb-3 text-xs text-red-400 font-mono max-w-[340px] break-all">
              {errorMessage.split("|")[1]?.split("(")[0]?.trim()}
              {errorMessage.includes("exit code:") && (
                <span className="text-orange-400">
                  {" "}
                  ({errorMessage.match(/\(exit code: \d+\)/)?.[0]})
                </span>
              )}
            </p>
          )}
          <a
            href={errorMessage.split("Download Node.js:")[1]?.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            Click here to download Node.js
          </a>
        </div>
      ) : status === "error" ? (
        <div className="text-sm text-muted-foreground text-center max-w-[320px]">
          <p>{errorMessage}</p>
        </div>
      ) : (
        <h1 className="text-sm text-muted-foreground text-center max-w-[280px]">
          {getStatusDescription()}
        </h1>
      )}

      {/* Loading animation - only shown when not in error state */}
      {status !== "error" && (
        <div className="mt-6">
          <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Error state shows retry button */}
      {status === "error" && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRestarting}
          className="mt-6 px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isRestarting ? t("toast.appStarting") : t("common.reconnect")}
        </button>
      )}
    </div>
  );
}
