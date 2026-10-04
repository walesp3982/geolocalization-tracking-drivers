import { normalizeAngle, smoothHeading } from "@/utils/heading";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

const GPS_HEADING_SPEED_THRESHOLD = 1.5;
const HEADING_UPDATE_INTERVAL_MS = 150;
const HEADING_SMOOTHING_ALPHA = 0.2;

export type HeadingSource = "gps" | "compass";

type HeadingState = {
  heading: number | null;
  accuracy: number | null;
  source: HeadingSource | null;
};

const INITIAL_HEADING_STATE: HeadingState = {
  heading: null,
  accuracy: null,
  source: null,
};

function isValidHeading(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function getSpeed(location: Location.LocationObject | null): number {
  const speed = location?.coords.speed;
  return speed !== null && speed !== undefined && Number.isFinite(speed)
    ? Math.max(0, speed)
    : 0;
}

export function useHeading(enabled: boolean): {
  heading: number | null;
  accuracy: number | null;
  source: HeadingSource | null;
  speed: number;
  location: Location.LocationObject | null;
  error: string | null;
} {
  const [headingState, setHeadingState] = useState<HeadingState>(
    INITIAL_HEADING_STATE,
  );
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let isActive = true;
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;
    let latestLocation: Location.LocationObject | null = null;
    let latestCompass: { heading: number; accuracy: number | null } | null =
      null;
    let previousHeading: number | null = null;
    let lastPublishedAt = 0;
    let pendingSample: HeadingState | null = null;
    let publishTimeout: ReturnType<typeof setTimeout> | null = null;

    const publishPendingSample = () => {
      if (!isActive || !pendingSample) return;

      const sample = pendingSample;
      pendingSample = null;
      publishTimeout = null;
      lastPublishedAt = Date.now();

      const smoothedHeading =
        previousHeading === null
          ? normalizeAngle(sample.heading ?? 0)
          : smoothHeading(
              previousHeading,
              sample.heading ?? previousHeading,
              HEADING_SMOOTHING_ALPHA,
            );
      previousHeading = smoothedHeading;
      setHeadingState({ ...sample, heading: smoothedHeading });
    };

    const queueHeading = (sample: HeadingState) => {
      pendingSample = sample;
      const remainingTime =
        HEADING_UPDATE_INTERVAL_MS - (Date.now() - lastPublishedAt);

      if (remainingTime <= 0) {
        if (publishTimeout) clearTimeout(publishTimeout);
        publishPendingSample();
      } else if (!publishTimeout) {
        publishTimeout = setTimeout(publishPendingSample, remainingTime);
      }
    };

    const updateHeading = () => {
      const speed = getSpeed(latestLocation);
      const gpsHeading = latestLocation?.coords.heading ?? null;

      if (speed > GPS_HEADING_SPEED_THRESHOLD && isValidHeading(gpsHeading)) {
        queueHeading({
          heading: gpsHeading,
          accuracy: latestLocation?.coords.accuracy ?? null,
          source: "gps",
        });
      } else if (latestCompass) {
        queueHeading({
          heading: latestCompass.heading,
          accuracy: latestCompass.accuracy,
          source: "compass",
        });
      }
    };

    const startSubscriptions = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isActive) return;
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setError("Location permission denied");
          return;
        }

        setError(null);
        const nextLocationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 1,
            timeInterval: 1000,
          },
          (nextLocation) => {
            if (!isActive) return;
            latestLocation = nextLocation;
            setLocation(nextLocation);
            updateHeading();
          },
          (reason) => {
            if (isActive) setError(reason);
          },
        );

        if (!isActive) {
          nextLocationSubscription.remove();
          return;
        }
        locationSubscription = nextLocationSubscription;

        const nextHeadingSubscription = await Location.watchHeadingAsync(
          (reading) => {
            if (!isActive) return;

            const compassHeading = isValidHeading(reading.trueHeading)
              ? reading.trueHeading
              : reading.magHeading;
            if (!isValidHeading(compassHeading)) return;

            latestCompass = {
              heading: compassHeading,
              accuracy: Number.isFinite(reading.accuracy)
                ? reading.accuracy
                : null,
            };
            updateHeading();
          },
          (reason) => {
            if (isActive) setError(reason);
          },
        );

        if (!isActive) {
          nextHeadingSubscription.remove();
          return;
        }
        headingSubscription = nextHeadingSubscription;
      } catch (subscriptionError) {
        if (isActive) {
          setError(
            subscriptionError instanceof Error
              ? subscriptionError.message
              : "Failed to start heading updates",
          );
        }
      }
    };

    startSubscriptions();

    return () => {
      isActive = false;
      locationSubscription?.remove();
      headingSubscription?.remove();
      if (publishTimeout) clearTimeout(publishTimeout);
    };
  }, [enabled]);

  return {
    ...headingState,
    speed: getSpeed(location),
    location,
    error,
  };
}
