import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (dsn) {
  const tracesRaw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0";
  const tracesSampleRate = Number.parseFloat(tracesRaw);
  Sentry.init({
    dsn,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
