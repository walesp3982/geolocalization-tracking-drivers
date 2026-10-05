import { apiRequest } from "@/services/api";
import {
  acknowledgeTrackingSample,
  enqueueTrackingSample,
  getPendingTrackingSamples,
  type TrackingSample,
} from "@/services/tracking-queue";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocationTracking } from "./use-location-tracking";
import { useWebSocket } from "./use-websocket";

const WS_APP = process.env.EXPO_PUBLIC_WS_URL ?? "ws://10.0.2.2:8000";
const WS_TRACKING = `${WS_APP.replace(/\/$/, "")}/tracking`;
const LOCATION_INTERVAL_MS = 500;

type TrackingEvent = {
  type?: string;
  ticket?: string;
  resume?: boolean;
  sample_id?: string;
  id_punto_control?: number | null;
  reached_checkpoints?: number[];
  success?: boolean;
  status?: string;
  code?: string;
  message?: string;
  reason?: string;
};

type TicketResponse = {
  ticket: string;
};

export type TrackingStatus =
  | "idle"
  | "connecting"
  | "waiting_start"
  | "active"
  | "reconnecting"
  | "stopping"
  | "finished";

function createSampleId(): string {
  const randomHex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${randomHex()}${randomHex()}-${randomHex()}-4${randomHex().slice(1)}-${randomHex()}-${randomHex()}${randomHex()}${randomHex()}`;
}

export default function useDriverTracking(
  assignmentId: number | undefined,
  onCheckpointReached: (checkpointId: number) => void,
  onFinished: (result: { success: boolean; status?: string }) => void,
): {
  location: import("./use-location-tracking").DeviceLocation | null;
  running: boolean;
  status: TrackingStatus;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  error: string | null;
} {
  const data = useLocationTracking({ timeInterval: 500 });
  const ws = useWebSocket(WS_TRACKING);
  const {
    getCurrentLocation,
    startTracking: startLocationTracking,
    stopTracking: stopLocationTracking,
    error: locationError,
  } = data;
  const {
    isConnected,
    startWebSocket,
    closeWebSocket,
    sendMessage,
    setMessageHandler,
    setCloseHandler,
  } = ws;
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const latestLocationRef = useRef(data.location);
  const assignmentIdRef = useRef(assignmentId);
  const desiredRef = useRef(false);
  const connectInFlightRef = useRef(false);
  const canSendLocationsRef = useRef(false);
  const queueDrainInFlightRef = useRef(false);
  const sampleInFlightRef = useRef<string | null>(null);
  const resumeAckPendingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const stopSentRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconnectRef = useRef<() => void>(() => undefined);
  const lastSampleTimestampRef = useRef<number | null>(null);
  const callbackRefs = useRef({ onCheckpointReached, onFinished });

  useEffect(() => {
    latestLocationRef.current = data.location;
  }, [data.location]);

  useEffect(() => {
    assignmentIdRef.current = assignmentId;
  }, [assignmentId]);

  useEffect(() => {
    callbackRefs.current = { onCheckpointReached, onFinished };
  }, [onCheckpointReached, onFinished]);

  const buildSample = useCallback(
    (
      location: NonNullable<typeof latestLocationRef.current>,
    ): TrackingSample => ({
      sample_id: createSampleId(),
      latitud: location.latitude,
      longitud: location.longitude,
      timestamp_frontend: new Date(location.timestamp).toISOString(),
    }),
    [],
  );

  const drainQueue = useCallback(async () => {
    const currentAssignmentId = assignmentIdRef.current;
    if (
      !currentAssignmentId ||
      !isConnected ||
      !canSendLocationsRef.current ||
      sampleInFlightRef.current ||
      queueDrainInFlightRef.current
    ) {
      return;
    }

    queueDrainInFlightRef.current = true;
    try {
      const pending = await getPendingTrackingSamples(currentAssignmentId);
      const next = pending[0];
      if (next) {
        if (sendMessage({ type: "location", sample: next })) {
          sampleInFlightRef.current = next.sample_id;
        }
        return;
      }

      if (stopRequestedRef.current && !stopSentRef.current) {
        stopSentRef.current = sendMessage({ type: "stop" });
      }
    } finally {
      queueDrainInFlightRef.current = false;
    }
  }, [isConnected, sendMessage]);

  const getNextSample = useCallback(async () => {
    const currentAssignmentId = assignmentIdRef.current;
    if (!currentAssignmentId) {
      throw new Error("No hay una asignación disponible para iniciar.");
    }
    const pending = await getPendingTrackingSamples(currentAssignmentId);
    if (pending.length) {
      return pending[0];
    }
    const location = await getCurrentLocation();
    if (!location) {
      throw new Error("No se pudo obtener una ubicación GPS inicial.");
    }
    const sample = buildSample(location);
    await enqueueTrackingSample(currentAssignmentId, sample);
    lastSampleTimestampRef.current = location.timestamp;
    return sample;
  }, [buildSample, getCurrentLocation]);

  const connect = useCallback(async () => {
    const currentAssignmentId = assignmentIdRef.current;
    if (
      !desiredRef.current ||
      !currentAssignmentId ||
      connectInFlightRef.current
    ) {
      return;
    }
    connectInFlightRef.current = true;
    canSendLocationsRef.current = false;
    setStatus(retryCountRef.current ? "reconnecting" : "connecting");
    try {
      const ticket = await apiRequest<TicketResponse>(
        "/conductor/tracking-ticket",
        {
          method: "POST",
          json: { id_asignacion: currentAssignmentId },
        },
      );
      await startWebSocket();
      sendMessage({ type: "auth", ticket: ticket.ticket });
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "No se pudo conectar al servicio de tracking.",
      );
      scheduleReconnectRef.current();
    } finally {
      connectInFlightRef.current = false;
    }
  }, [sendMessage, startWebSocket]);

  const handleEvent = useCallback(
    async (rawEvent: unknown) => {
      if (!rawEvent || typeof rawEvent !== "object") {
        return;
      }
      const event = rawEvent as TrackingEvent;
      if (event.type === "authorized") {
        retryCountRef.current = 0;
        setError(null);
        try {
          const sample = await getNextSample();
          if (event.resume) {
            resumeAckPendingRef.current = true;
            sendMessage({ type: "resume", sample });
            setStatus("active");
          } else {
            setStatus("waiting_start");
            sendMessage({ type: "start", sample });
          }
        } catch (startError) {
          desiredRef.current = false;
          setError(
            startError instanceof Error
              ? startError.message
              : "No se pudo preparar el tracking.",
          );
          closeWebSocket();
        }
        return;
      }

      if (event.type === "ack" && event.sample_id) {
        const currentAssignmentId = assignmentIdRef.current;
        if (currentAssignmentId) {
          await acknowledgeTrackingSample(currentAssignmentId, event.sample_id);
        }
        if (sampleInFlightRef.current === event.sample_id) {
          sampleInFlightRef.current = null;
        }
        if (typeof event.id_punto_control === "number") {
          callbackRefs.current.onCheckpointReached(event.id_punto_control);
        }
        event.reached_checkpoints?.forEach((checkpointId) => {
          callbackRefs.current.onCheckpointReached(checkpointId);
        });
        if (resumeAckPendingRef.current) {
          resumeAckPendingRef.current = false;
          canSendLocationsRef.current = true;
          setRunning(true);
          setStatus("active");
          await startLocationTracking();
        }
        await drainQueue();
        return;
      }

      if (event.type === "ready") {
        canSendLocationsRef.current = true;
        setRunning(true);
        setStatus("active");
        await startLocationTracking();
        await drainQueue();
        return;
      }

      if (event.type === "finished") {
        desiredRef.current = false;
        canSendLocationsRef.current = false;
        stopLocationTracking();
        setRunning(false);
        setStatus("finished");
        callbackRefs.current.onFinished({
          success: event.success === true,
          status: event.status,
        });
        closeWebSocket();
        return;
      }

      if (event.type === "error") {
        setError(event.message ?? "El servidor rechazó el tracking.");
        if (event.code === "first_checkpoint_required") {
          const currentAssignmentId = assignmentIdRef.current;
          const pending = currentAssignmentId
            ? await getPendingTrackingSamples(currentAssignmentId)
            : [];
          const attempted = pending[0];
          if (currentAssignmentId && attempted) {
            await acknowledgeTrackingSample(
              currentAssignmentId,
              attempted.sample_id,
            );
          }
        }
        desiredRef.current = false;
        canSendLocationsRef.current = false;
        stopLocationTracking();
        setRunning(false);
        setStatus("idle");
        closeWebSocket();
      }
    },
    [
      closeWebSocket,
      drainQueue,
      getNextSample,
      sendMessage,
      startLocationTracking,
      stopLocationTracking,
    ],
  );

  useEffect(() => {
    scheduleReconnectRef.current = () => {
      if (!desiredRef.current || retryTimerRef.current) {
        return;
      }
      retryCountRef.current += 1;
      const delay = Math.min(
        1000 * 2 ** Math.min(retryCountRef.current, 5),
        30000,
      );
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void connect();
      }, delay);
    };
  }, [connect]);

  useEffect(() => {
    setMessageHandler((message) => {
      void handleEvent(message);
    });
    setCloseHandler(() => {
      canSendLocationsRef.current = false;
      sampleInFlightRef.current = null;
      if (desiredRef.current) {
        setStatus("reconnecting");
        scheduleReconnectRef.current();
      }
    });
  }, [handleEvent, setCloseHandler, setMessageHandler]);

  useEffect(() => {
    if (!running || !assignmentId) {
      return;
    }
    const interval = setInterval(() => {
      const location = latestLocationRef.current;
      if (!location || lastSampleTimestampRef.current === location.timestamp) {
        return;
      }
      lastSampleTimestampRef.current = location.timestamp;
      const sample = buildSample(location);
      void enqueueTrackingSample(assignmentId, sample).then(() => drainQueue());
    }, LOCATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [assignmentId, buildSample, drainQueue, running]);

  useEffect(
    () => () => {
      desiredRef.current = false;
      stopLocationTracking();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      closeWebSocket();
    },
    [closeWebSocket, stopLocationTracking],
  );

  const startTracking = async () => {
    if (!assignmentIdRef.current) {
      setError("No hay una ruta asignada para iniciar el tracking.");
      return;
    }
    desiredRef.current = true;
    stopRequestedRef.current = false;
    stopSentRef.current = false;
    setError(null);
    setStatus("connecting");
    await connect();
  };

  const stopTracking = () => {
    stopRequestedRef.current = true;
    setStatus("stopping");
    stopLocationTracking();
    if (canSendLocationsRef.current) {
      void drainQueue();
    }
  };

  return {
    location: data.location,
    running,
    status,
    startTracking,
    stopTracking,
    error: error ?? locationError,
  };
}
