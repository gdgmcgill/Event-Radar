type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

const isDev = process.env.NODE_ENV === "development";

function formatEntry(entry: LogEntry): string {
  if (isDev) {
    const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const err = entry.error ? ` | ${entry.error.message}` : "";
    return `[${entry.level.toUpperCase()}] ${entry.message}${ctx}${err}`;
  }
  return JSON.stringify(entry);
}

function extractError(err: unknown): { message: string; stack?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

export const logger = {
  info(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      context,
    };
    console.log(formatEntry(entry));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      context,
    };
    console.warn(formatEntry(entry));
  },

  error(message: string, err?: unknown, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      context,
      error: extractError(err),
    };
    console.error(formatEntry(entry));
  },
};
