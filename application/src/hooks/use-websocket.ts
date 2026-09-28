import { useCallback, useEffect, useRef, useState } from "react";

export function useWebSocket(url: string) {
  const socketRef = useRef<WebSocket | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
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
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [url]);

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
    sendMessage,
  };
}
