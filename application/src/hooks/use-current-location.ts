import * as Location from "expo-location";
import { useState } from "react";

export function useCurrentLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );

  const [loading, setLoading] = useState(false);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        throw new Error("Location permission denied");
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(location);

      return location;
    } finally {
      setLoading(false);
    }
  };

  return {
    location,
    loading,
    getCurrentLocation,
  };
}
