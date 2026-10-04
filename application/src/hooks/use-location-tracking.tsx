import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

type UseLocationTrackingOptions = {
  timeInterval?: number;
  distanceInterval?: number;
};

export function useLocationTracking({
  timeInterval = 5000,
  distanceInterval = 0,
}: UseLocationTrackingOptions = {}): {
  location: DeviceLocation | null;
  error: string | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
} {
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const startTracking = async () => {
    try {
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        setError("Location permission denied");
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval,
          distanceInterval,
        },
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          setLocation({
            latitude,
            longitude,
            accuracy,
            timestamp: position.timestamp,
          });
        },
      );

      subscriptionRef.current = subscription;
      setIsTracking(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start location tracking",
      );
    }
  };

  const stopTracking = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsTracking(false);
  };

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
}
