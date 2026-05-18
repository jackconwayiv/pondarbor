import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

import { fetchWhatIfHandState, fetchWhatIfTvState } from "./api";
import type { WhatIfSessionState } from "./types";
import { whatifSessionWsUrl } from "./whatifWs";
import { connectWhatIfWebSocket } from "./whatifWsClient";

const WS_PING_MS = 2000;

/** Skip conditional GET in dev — Vite proxy can turn HTTP 304 into 502. */
function useSinceParam(): boolean {
  return !import.meta.env.DEV;
}

export type WhatIfSessionSyncMode = "tv" | "hand";

export type UseWhatIfSessionSyncOptions = {
  roomCode: string;
  mode: WhatIfSessionSyncMode;
  playerToken?: string | null;
  enabled?: boolean;
  /** When `voting`, sends WS ping for server auto-reveal checks. */
  sessionStatus?: WhatIfSessionState["status"] | null;
  onState: (state: WhatIfSessionState) => void;
  onError?: (message: string) => void;
  /** After a successful POST, set to response state_version to skip redundant refetch. */
  skipRefetchAtVersionRef?: MutableRefObject<number>;
};

export function useWhatIfSessionSync(options: UseWhatIfSessionSyncOptions): void {
  const {
    roomCode,
    mode,
    playerToken = null,
    enabled = true,
    sessionStatus = null,
    onState,
    onError,
    skipRefetchAtVersionRef,
  } = options;

  const onStateRef = useRef(onState);
  const onErrorRef = useRef(onError);
  const lastVersionRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const useSince = useSinceParam();

  onStateRef.current = onState;
  onErrorRef.current = onError;

  const refetch = useCallback(async () => {
    const since = useSince ? lastVersionRef.current : undefined;
    if (mode === "hand") {
      if (!playerToken) return null;
      return fetchWhatIfHandState(roomCode, playerToken, since);
    }
    return fetchWhatIfTvState(roomCode, since);
  }, [mode, playerToken, roomCode, useSince]);

  const applyFetched = useCallback(
    (next: WhatIfSessionState | null) => {
      if (!next) return;
      const skipAt = skipRefetchAtVersionRef?.current ?? 0;
      if (next.state_version <= skipAt) {
        lastVersionRef.current = Math.max(lastVersionRef.current, next.state_version);
        return;
      }
      if (next.state_version <= lastVersionRef.current) return;
      lastVersionRef.current = next.state_version;
      onStateRef.current(next);
    },
    [skipRefetchAtVersionRef],
  );

  const doRefetch = useCallback(async () => {
    try {
      const next = await refetch();
      applyFetched(next);
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : "Failed to load session");
    }
  }, [applyFetched, refetch]);

  useEffect(() => {
    lastVersionRef.current = 0;
  }, [roomCode, mode, playerToken]);

  useEffect(() => {
    if (!enabled || roomCode.length !== 4) return;
    if (mode === "hand" && !playerToken) return;

    void doRefetch();

    const disconnect = connectWhatIfWebSocket({
      getUrl: async () => whatifSessionWsUrl(roomCode, mode === "hand" ? playerToken : null),
      onOpen: (socket) => {
        wsRef.current = socket;
      },
      onMessage: (msg) => {
        if (msg.type !== "connected" && msg.type !== "session_update") return;
        const remoteVersion = msg.state_version;
        if (typeof remoteVersion === "number" && remoteVersion <= lastVersionRef.current) {
          const skipAt = skipRefetchAtVersionRef?.current ?? 0;
          if (remoteVersion <= skipAt) return;
        }
        void doRefetch();
      },
    });

    return () => {
      wsRef.current = null;
      disconnect();
    };
  }, [
    doRefetch,
    enabled,
    mode,
    playerToken,
    roomCode,
    skipRefetchAtVersionRef,
  ]);

  useEffect(() => {
    if (sessionStatus !== "voting") return;
    const id = window.setInterval(() => {
      const socket = wsRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, WS_PING_MS);
    return () => window.clearInterval(id);
  }, [sessionStatus]);
}
