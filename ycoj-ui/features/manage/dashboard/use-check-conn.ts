import {
  appendCheckConnEntries,
  parseCheckConnMessage,
  type CheckConnEntry,
} from './check-conn-log';
import { createCheckConnUrl } from './check-conn-url';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';

export type CheckConnStatus =
  'unsupported' | 'connecting' | 'open' | 'closed' | 'failed';

/**
 * Streams `/manage/check-conn` diagnostics over WebSocket.
 * When `NEXT_PUBLIC_WEBSOCKET_BASEURL` is unset the hook reports
 * `unsupported` and makes no connection attempt.
 */
export function useCheckConn() {
  const url = createCheckConnUrl();
  const [entries, setEntries] = useState<CheckConnEntry[]>([]);
  const [status, setStatus] = useState<CheckConnStatus>(
    url ? 'connecting' : 'unsupported'
  );
  const socketRef = useRef<ReconnectingWebSocket | null>(null);
  const [attempt, setAttempt] = useState(0);

  const restart = useCallback(() => {
    setEntries([]);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!url) return;

    const socket = new ReconnectingWebSocket(url, [], {
      maxReconnectionDelay: 10_000,
      maxRetries: 0,
    });
    socketRef.current = socket;

    socket.onopen = () => setStatus('open');
    socket.onmessage = (event: MessageEvent) => {
      const entry = parseCheckConnMessage(event.data);
      if (!entry) return;
      setEntries((current) => appendCheckConnEntries(current, entry));
    };
    socket.onerror = () => setStatus('failed');
    socket.onclose = () => setStatus('closed');

    return () => {
      socketRef.current = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    };
  }, [url, attempt]);

  return { entries, status, restart };
}
