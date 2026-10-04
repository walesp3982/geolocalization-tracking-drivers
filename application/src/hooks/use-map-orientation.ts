import { normalizeAngle } from "@/utils/heading";
import type { LocationObject } from "expo-location";
import { useEffect, useRef, useState } from "react";
import MapView from "react-native-maps";

export type MapOrientationMode = "north" | "follow" | "rotate";

type UseMapOrientationOptions = {
  enabled: boolean;
  heading: number | null;
  location: LocationObject | null;
};

export function useMapOrientation({
  enabled,
  heading,
  location,
}: UseMapOrientationOptions) {
  const mapRef = useRef<MapView>(null);
  const [mode, setMode] = useState<MapOrientationMode>("rotate");
  const cameraHeading =
    mode === "rotate" && heading !== null ? normalizeAngle(heading) : 0;
  const pointerHeading =
    mode === "rotate"
      ? cameraHeading
      : heading === null
        ? 0
        : normalizeAngle(heading);

  useEffect(() => {
    if (!enabled || mode !== "north") return;
    mapRef.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 200 });
  }, [enabled, mode]);

  useEffect(() => {
    if (!enabled || mode === "north" || !location) return;

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        heading: cameraHeading,
        pitch: 0,
      },
      { duration: 200 },
    );
  }, [cameraHeading, enabled, location, mode]);

  const cycleMode = () => {
    setMode((currentMode) =>
      currentMode === "north"
        ? "follow"
        : currentMode === "follow"
          ? "rotate"
          : "north",
    );
  };

  const stopFollowing = () => setMode("north");

  return {
    mapRef,
    mode,
    cameraHeading,
    pointerHeading,
    cycleMode,
    stopFollowing,
  };
}
