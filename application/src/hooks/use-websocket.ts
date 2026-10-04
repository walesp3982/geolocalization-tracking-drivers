import { useCallback, useRef, useState } from "react";

export function useWebSocket(url: string) {
  const socketRef = useRef<WebSocket | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  const startWebSocket = useCallback(() => {
    // Evitar crear otra conexión si ya existe
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.warn("WebSocket ya está conectado o conectándose");
      return;
    }

    const socket = new WebSocket(url);

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket conectado");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      console.log("Mensaje recibido:", event.data);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket cerrado");
      setIsConnected(false);

      // Solo limpiar si este sigue siendo el socket actual
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
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

  const sendMessage = useCallback((data: unknown) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket no está conectado");
      return;
    }

    socket.send(JSON.stringify(data));
  }, []);

  return {
    isConnected,
    startWebSocket,
    closeWebSocket,
    sendMessage,
  };
}
