import { useCallback, useRef, useState } from "react";

export function useWebSocket(url: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const messageHandlerRef = useRef<(message: unknown) => void>(() => undefined);
  const closeHandlerRef = useRef<() => void>(() => undefined);
  const [isConnected, setIsConnected] = useState(false);

  const setMessageHandler = useCallback(
    (handler: (message: unknown) => void) => {
      messageHandlerRef.current = handler;
    },
    [],
  );

  const setCloseHandler = useCallback((handler: () => void) => {
    closeHandlerRef.current = handler;
  }, []);

  const startWebSocket = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const currentSocket = socketRef.current;
      if (currentSocket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      if (currentSocket?.readyState === WebSocket.CONNECTING) {
        reject(new Error("El WebSocket todavía se está conectando."));
        return;
      }

      const socket = new WebSocket(url);
      socketRef.current = socket;
      let settled = false;

      socket.onopen = () => {
        setIsConnected(true);
        settled = true;
        resolve();
      };
      socket.onmessage = (event) => {
        try {
          messageHandlerRef.current(JSON.parse(String(event.data)) as unknown);
        } catch {
          messageHandlerRef.current(event.data);
        }
      };
      socket.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("No se pudo conectar al servidor de tracking."));
        }
      };
      socket.onclose = () => {
        setIsConnected(false);
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        closeHandlerRef.current();
      };
    });
  }, [url]);

  const closeWebSocket = useCallback(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    socket.close();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((data: unknown): boolean => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(data));
    return true;
  }, []);

  return {
    isConnected,
    startWebSocket,
    closeWebSocket,
    sendMessage,
    setMessageHandler,
    setCloseHandler,
  };
}
