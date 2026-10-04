import { useEffect, useRef, useState } from "react";
import { useLocationTracking } from "./use-location-tracking";
import { useWebSocket } from "./use-websocket";

const WS_APP = process.env.EXPO_PUBLIC_WS_URL ?? "ws://10.0.2.2:8000";
const WS_TRACKING = WS_APP + "/tracking";

export default function useDriverTracking(): {
  location: import("./use-location-tracking").DeviceLocation | null;
  running: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  error: string | null;
} {
  let data = useLocationTracking({ timeInterval: 1000 });
  let ws = useWebSocket(WS_TRACKING);
  const [isOpenning, setOpening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const latestLocationRef = useRef(data.location);

  useEffect(() => {
    latestLocationRef.current = data.location;
  }, [data.location]);

  useEffect(() => {
    if (!isOpenning || !ws.isConnected) return;

    const intervalId = setInterval(() => {
      const currentLocation = latestLocationRef.current;
      if (currentLocation) {
        console.log("Sending data ", currentLocation);
        ws.sendMessage(currentLocation);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isOpenning, ws.isConnected, ws.sendMessage]);

  const startTracking = () => {
    setOpening(true);
    ws.startWebSocket();
    data.startTracking();
  };

  const stopTracking = () => {
    setOpening(false);
    ws.closeWebSocket();
  };

  return {
    location: data.location,
    running: isOpenning,
    startTracking: startTracking,
    stopTracking: stopTracking,
    error,
  };
}
