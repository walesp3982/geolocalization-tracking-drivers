import { useEffect, useState } from "react";
import { useLocationTracking } from "./use-location-tracking";
import { useWebSocket } from "./use-websocket";

const WS_APP = process.env.EXPO_PUBLIC_API_URL ?? "ws://10.0.2.2:8000";
const WS_TRACKING = WS_APP + "/tracking";

export default function useDriverTracking(): {
  location: import("./use-location-tracking").DeviceLocation | null;
  running: boolean;
  startTracking: () => void;
  finishedTracking: () => void;
  error: string | null;
} {
  let data = useLocationTracking();
  let ws = useWebSocket(WS_TRACKING);
  let [error, setError] = useState<string | null>(null);
  let [running, setRunning] = useState<boolean>(true);

  useEffect(() => {
    if (running) {
      if (ws.isConnected) {
        data.isTracking! && data.startTracking();
        if (data.error) {
          console.log(data.error);
        }
        console.log("Sending data: ", data.location);
        ws.sendMessage(data.location);
      } else {
        data.stopTracking();
        setError("Unexpected error");
        setRunning(false);
      }
    } else {
      data.stopTracking();
    }
  }, [running]);

  return {
    location: data.location,
    running,
    startTracking: () => setRunning(true),
    finishedTracking: () => setRunning(false),
    error,
  };
}
