import { getPondarborPublicConfig } from "./auth/publicConfig";

export type SentryInitOptions = {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
};

function shellSentryDsn(): string | undefined {
  if (import.meta.env.DEV) return undefined;
  const dsn = getPondarborPublicConfig().sentryDsn;
  if (typeof dsn !== "string") return undefined;
  const trimmed = dsn.trim();
  return trimmed || undefined;
}

export function isSentryEnabled(): boolean {
  return shellSentryDsn() != null;
}

export function getSentryInitOptions(): SentryInitOptions | null {
  const dsn = shellSentryDsn();
  if (!dsn) return null;

  const config = getPondarborPublicConfig();
  const tracesRaw = config.sentryTracesSampleRate ?? "0";
  const tracesSampleRate = Number.parseFloat(tracesRaw);
  const environment =
    (typeof config.sentryEnvironment === "string"
      ? config.sentryEnvironment.trim()
      : "") || "production";

  return {
    dsn,
    environment,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  };
}
