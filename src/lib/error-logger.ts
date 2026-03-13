import { supabase } from "@/integrations/supabase/client";

interface ErrorLogEntry {
  type: "client" | "edge" | "auth" | "api";
  message: string;
  stack_trace?: string;
  metadata?: Record<string, any>;
  source?: string;
}

const ERROR_LOG_KEY = "dev_error_log_queue";
let devPin: string | null = null;

export function setDevPin(pin: string) {
  devPin = pin;
}

async function sendErrorLog(entry: ErrorLogEntry) {
  try {
    // Try to send via edge function (no auth needed, PIN-based)
    const storedPin = devPin || sessionStorage.getItem("dev_pin");
    if (!storedPin) {
      // Queue for later
      const queue = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]");
      queue.push({ ...entry, created_at: new Date().toISOString() });
      if (queue.length > 200) queue.shift(); // cap at 200
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(queue));
      return;
    }

    await supabase.functions.invoke("dev-tools", {
      body: {
        action: "log_error",
        pin: storedPin,
        ...entry,
      },
    });
  } catch {
    // Silently fail - don't create error loops
  }
}

export function logError(entry: ErrorLogEntry) {
  sendErrorLog(entry);
}

export function flushErrorQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]");
    if (queue.length === 0) return;
    
    for (const entry of queue) {
      sendErrorLog(entry);
    }
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch {
    // Silently fail
  }
}

// Global error handlers
export function initGlobalErrorLogging() {
  window.addEventListener("error", (event) => {
    logError({
      type: "client",
      message: event.message || "Unknown error",
      stack_trace: event.error?.stack,
      source: `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logError({
      type: "client",
      message: event.reason?.message || String(event.reason) || "Unhandled promise rejection",
      stack_trace: event.reason?.stack,
      source: "unhandledrejection",
    });
  });

  // Intercept fetch errors for API logging
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      if (!response.ok && response.status >= 500) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
        logError({
          type: "api",
          message: `API Error ${response.status}: ${response.statusText}`,
          source: url,
          metadata: { status: response.status },
        });
      }
      return response;
    } catch (error: any) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      logError({
        type: "api",
        message: error.message || "Network error",
        stack_trace: error.stack,
        source: url,
      });
      throw error;
    }
  };
}
