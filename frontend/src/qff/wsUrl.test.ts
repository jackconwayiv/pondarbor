import { describe, expect, it } from "vitest";

function wsUrl({
  token,
  windowProtocol,
  windowHost,
  viteApiBaseUrl,
}: {
  token: string;
  windowProtocol: "http:" | "https:";
  windowHost: string;
  viteApiBaseUrl: string;
}): string {
  const path = "/api/v1/qff/ws/session/";
  const tokenParam = `token=${encodeURIComponent(token)}`;
  const raw = (viteApiBaseUrl ?? "").trim();
  if (!raw) {
    const proto = windowProtocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${windowHost}${path}?${tokenParam}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    const prefix = (u.pathname || "").replace(/\/$/, "");
    return `${wsProto}//${u.host}${prefix}${path}?${tokenParam}`;
  }
  const prefix = raw.startsWith("/") ? raw : `/${raw}`;
  const base = prefix.replace(/\/$/, "");
  const proto = windowProtocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${windowHost}${base}${path}?${tokenParam}`;
}

describe("qff websocket url join", () => {
  it("uses same-origin ws when VITE_API_BASE_URL is unset", () => {
    const u = wsUrl({
      token: "t ok",
      windowProtocol: "https:",
      windowHost: "app.example.com",
      viteApiBaseUrl: "",
    });
    expect(u).toBe(
      "wss://app.example.com/api/v1/qff/ws/session/?token=t%20ok",
    );
  });

  it("preserves path prefix for string base URLs", () => {
    const u = wsUrl({
      token: "tok",
      windowProtocol: "http:",
      windowHost: "localhost:5173",
      viteApiBaseUrl: "/proxy",
    });
    expect(u).toBe("ws://localhost:5173/proxy/api/v1/qff/ws/session/?token=tok");
  });

  it("preserves pathname for absolute base URLs with a path prefix", () => {
    const u = wsUrl({
      token: "tok",
      windowProtocol: "https:",
      windowHost: "ignored.local",
      viteApiBaseUrl: "https://api.example.com/proxy",
    });
    expect(u).toBe("wss://api.example.com/proxy/api/v1/qff/ws/session/?token=tok");
  });
});

