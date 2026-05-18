/** Shared Estates WebSocket connect with exponential backoff (deploy / network blips). */

const ESTATES_WS_RECONNECT_BASE_MS = 1200;
const ESTATES_WS_RECONNECT_MAX_MS = 60_000;

export type EstatesWsConnectOptions = {
  getUrl: () => Promise<string>;
  onMessage: (data: { type?: string }) => void;
};

export function connectEstatesWebSocket(options: EstatesWsConnectOptions): () => void {
  let cancelled = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let attempt = 0;

  const scheduleReconnect = () => {
    if (cancelled) return;
    const delay = Math.min(
      ESTATES_WS_RECONNECT_BASE_MS * 2 ** attempt,
      ESTATES_WS_RECONNECT_MAX_MS,
    );
    attempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (cancelled) return;
    try {
      const url = await options.getUrl();
      if (cancelled) return;
      const s = new WebSocket(url);
      socket = s;
      s.onopen = () => {
        attempt = 0;
      };
      s.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type?: string };
          options.onMessage(msg);
        } catch {
          /* ignore malformed events */
        }
      };
      s.onclose = () => {
        if (!cancelled) scheduleReconnect();
      };
      s.onerror = () => {
        s.close();
      };
    } catch {
      if (!cancelled) scheduleReconnect();
    }
  };

  void connect();

  return () => {
    cancelled = true;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
    }
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}
