/** Auth0 + SPA flags from Django `json_script` (production) or Vite env (local dev). */

export type PondarborPublicConfig = {
  auth0Domain: string;
  auth0ClientId: string;
  auth0ApiAudience?: string | null;
  auth0SlackConnection?: string | null;
  /** Production-only: injected when `DEBUG=false` and `SENTRY_DSN` is set on the server. */
  sentryDsn?: string | null;
  sentryEnvironment?: string | null;
  sentryTracesSampleRate?: string | null;
};

function readJsonScript(id: string): PondarborPublicConfig | null {
  const el = document.getElementById(id);
  if (!el?.textContent?.trim()) return null;
  try {
    return JSON.parse(el.textContent) as PondarborPublicConfig;
  } catch {
    return null;
  }
}

function fromViteEnv(): PondarborPublicConfig {
  return {
    auth0Domain: (import.meta.env.VITE_AUTH0_DOMAIN as string | undefined) ?? "",
    auth0ClientId: (import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined) ?? "",
    auth0ApiAudience: import.meta.env.VITE_AUTH0_API_AUDIENCE as string | undefined,
    auth0SlackConnection: import.meta.env.VITE_AUTH0_SLACK_CONNECTION as
      | string
      | undefined,
  };
}

export function getPondarborPublicConfig(): PondarborPublicConfig {
  return readJsonScript("pondarbor-public-config") ?? fromViteEnv();
}

export function auth0ApiAudience(): string | undefined {
  const a = getPondarborPublicConfig().auth0ApiAudience;
  if (typeof a !== "string") return undefined;
  const t = a.trim();
  return t || undefined;
}

export function auth0SlackConnectionName(): string | undefined {
  const raw = getPondarborPublicConfig().auth0SlackConnection;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}
