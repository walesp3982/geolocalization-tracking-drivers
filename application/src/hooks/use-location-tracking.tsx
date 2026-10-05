import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

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
  timeInterval = 500,
  distanceInterval = 0,
}: UseLocationTrackingOptions = {}): {
  location: DeviceLocation | null;
  error: string | null;
  isTracking: boolean;
  getCurrentLocation: () => Promise<DeviceLocation | null>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
} {
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const getCurrentLocation =
    useCallback(async (): Promise<DeviceLocation | null> => {
      try {
        setError(null);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          setError(
            "Se necesita permiso de ubicación para iniciar el tracking.",
          );
          return null;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setLocation(currentLocation);
        return currentLocation;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo obtener la ubicación.",
        );
        return null;
      }
    }, []);

  const startTracking = useCallback(async () => {
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
  }, [distanceInterval, timeInterval]);

  const stopTracking = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, [stopTracking]);

  return {
    location,
    error,
    isTracking,
    getCurrentLocation,
    startTracking,
    stopTracking,
  };
}
