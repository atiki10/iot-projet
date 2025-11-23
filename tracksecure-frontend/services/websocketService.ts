type MessageHandler<T> = (data: T) => void;

interface WSHandle {
  close: () => void;
}

/**
 * Simple WebSocket wrapper with automatic reconnect and JSON parsing.
 * - `url` should be a ws:// or wss:// endpoint
 * - messages are expected to be JSON
 */
export function connectWebSocket<T = any>(url: string, onMessage: MessageHandler<T>, onOpen?: () => void, onClose?: (ev?: CloseEvent) => void): WSHandle {
  let ws: WebSocket | null = null;
  let shouldReconnect = true;
  let reconnectAttempts = 0;
  let reconnectTimer: number | undefined;

  function create() {
    try {
      ws = new WebSocket(url);
    } catch (err) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      console.info('WS: socket opened', url);
      if (onOpen) onOpen();
    };

    ws.onmessage = async (ev) => {
      try {
        let text: string;
        if (typeof ev.data === 'string') {
          text = ev.data;
        } else if (ev.data instanceof Blob) {
          // modern browsers support text() on Blob
          try {
            text = await ev.data.text();
          } catch (e) {
            // fallback to FileReader if text() not available
            text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsText(ev.data as Blob);
            });
          }
        } else if (ev.data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(ev.data as ArrayBuffer);
        } else {
          // unknown payload type
          console.warn('WS: unknown message data type', ev.data);
          return;
        }

        // attempt parse
        try {
          const parsed = JSON.parse(text) as T;
          onMessage(parsed);
        } catch (parseErr) {
          console.warn('WS: received non-JSON message', text, parseErr);
        }
      } catch (e) {
        console.error('WS: error processing incoming message', e);
      }
    };

    ws.onclose = (ev) => {
      console.info('WS: socket closed', ev.code, ev.reason);
      if (onClose) onClose(ev);
      if (shouldReconnect) scheduleReconnect();
    };

    ws.onerror = (ev) => {
      console.error('WS: socket error', ev);
      // error will usually be followed by close -> reconnect
      try { if (ws) ws.close(); } catch(_) {}
    };
  }

  function scheduleReconnect() {
    reconnectAttempts += 1;
    const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts));
    reconnectTimer = window.setTimeout(() => {
      create();
    }, delay);
  }

  function close() {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  create();

  return { close };
}

export default connectWebSocket;
