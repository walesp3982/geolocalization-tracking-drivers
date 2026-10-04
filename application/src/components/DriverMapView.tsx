import DriverTrackingControls from "@/components/DriverButtonTracking";
import { ThemedView } from "@/components/themed-view";
import { useHeading } from "@/hooks/use-heading";
import { useMapOrientation } from "@/hooks/use-map-orientation";
import { apiRequest } from "@/services/api";
import { useNetworkState } from "expo-network";
import { SymbolView } from "expo-symbols";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";

interface PointerColors {
  bgColor: string;
  borderColor: string;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface RouteControlPoint {
  id: number | string;
  coordinate: RoutePoint;
  radius: number;
  relativeNumber?: number | null;
}

interface RouteAssignment {
  id_asignacion?: number;
  id_ruta?: number;
  id_conductor?: number;
  numero_ruta?: string;
  lugar_inicial?: string;
  lugar_final?: string;
  tiempo_estimado?: number | null;
  fecha_hora_inicio?: string | null;
  fecha_hora_comienzo?: string | null;
  fecha_hora_fin?: string | null;
  routeCoordinates: RoutePoint[];
  controlPoints: RouteControlPoint[];
}

const pointerActive: PointerColors = {
  bgColor: "#2ed37b",
  borderColor: "#7af622",
};

const pointerInactive: PointerColors = {
  bgColor: "#f7d653",
  borderColor: "#ffca1c",
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractCoordsFromGeometry(input: unknown): RoutePoint[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const source = input as Record<string, unknown>;
  const geometry = source.geometry as Record<string, unknown> | undefined;
  const line = source.line as Record<string, unknown> | undefined;
  const ruta = source.ruta as Record<string, unknown> | undefined;
  const rutaLine = ruta?.line as Record<string, unknown> | undefined;
  const rutaGeometry = ruta?.geometry as Record<string, unknown> | undefined;

  const coordinates = Array.isArray(source.coordinates)
    ? source.coordinates
    : Array.isArray(geometry?.coordinates)
      ? geometry.coordinates
      : Array.isArray(line?.coordinates)
        ? line.coordinates
        : Array.isArray(rutaLine?.coordinates)
          ? rutaLine.coordinates
          : Array.isArray(rutaGeometry?.coordinates)
            ? rutaGeometry.coordinates
            : [];

  if (!Array.isArray(coordinates)) {
    return [];
  }

  return coordinates.flatMap((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      return [];
    }

    const longitude = toNumber(point[0]);
    const latitude = toNumber(point[1]);

    if (longitude === null || latitude === null) {
      return [];
    }

    return [{ latitude, longitude }];
  });
}

function extractPointCoordinate(input: unknown): RoutePoint | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input as Record<string, unknown>;
  const point =
    source.ubicacion ?? source.geometry ?? source.location ?? source;
  const coordinates = Array.isArray(point)
    ? point
    : point && typeof point === "object"
      ? (point as Record<string, unknown>).coordinates
      : null;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const longitude = toNumber(coordinates[0]);
  const latitude = toNumber(coordinates[1]);
  if (longitude === null || latitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeRouteAssignment(raw: unknown): RouteAssignment | null {
  if (!raw) {
    return null;
  }

  const items = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.asignaciones)
      ? ((raw as Record<string, unknown>).asignaciones as unknown[])
      : [raw];

  if (!items.length) {
    return null;
  }

  const ordered = [...items].sort((left, right) => {
    const leftDate = new Date(
      (left as Record<string, unknown>)?.fecha_hora_inicio as string | number,
    ).getTime();
    const rightDate = new Date(
      (right as Record<string, unknown>)?.fecha_hora_inicio as string | number,
    ).getTime();
    return Number.isNaN(leftDate) || Number.isNaN(rightDate)
      ? 0
      : leftDate - rightDate;
  });

  const nextAssignment = ordered[0] as Record<string, unknown> | undefined;
  if (!nextAssignment) {
    return null;
  }

  const route =
    (nextAssignment.ruta as Record<string, unknown>) ??
    (nextAssignment.route as Record<string, unknown>) ??
    nextAssignment;

  const routeCoordinates = extractCoordsFromGeometry(
    route?.line ?? route?.geometry ?? route?.coordinates ?? nextAssignment,
  );
  const controlPoints = Array.isArray(route?.puntos_control)
    ? route.puntos_control.flatMap((rawPoint, index) => {
        if (!rawPoint || typeof rawPoint !== "object") {
          return [];
        }

        const point = rawPoint as Record<string, unknown>;
        const coordinate = extractPointCoordinate(point);
        const radius = toNumber(point.radio);

        if (!coordinate || radius === null || radius <= 0) {
          return [];
        }

        return [
          {
            id:
              toNumber(point.id_punto_control) ??
              toNumber(point.n_puntos_relativo) ??
              index,
            coordinate,
            radius,
            relativeNumber: toNumber(point.n_puntos_relativo),
          },
        ];
      })
    : [];

  return {
    id_asignacion: toNumber(nextAssignment.id_asignacion) ?? undefined,
    id_ruta:
      toNumber(nextAssignment.id_ruta) ?? toNumber(route?.id_ruta) ?? undefined,
    id_conductor: toNumber(nextAssignment.id_conductor) ?? undefined,
    numero_ruta:
      (route?.numero_ruta as string | undefined) ??
      (nextAssignment.numero_ruta as string | undefined) ??
      undefined,
    lugar_inicial:
      (route?.lugar_inicial as string | undefined) ??
      (route?.lugar_initial as string | undefined) ??
      undefined,
    lugar_final: (route?.lugar_final as string | undefined) ?? undefined,
    tiempo_estimado:
      toNumber(route?.tiempo_estimado) ??
      toNumber(nextAssignment.tiempo_estimado) ??
      null,
    fecha_hora_inicio:
      (nextAssignment.fecha_hora_inicio as string | undefined) ?? null,
    fecha_hora_comienzo:
      (nextAssignment.fecha_hora_comienzo as string | undefined) ?? null,
    fecha_hora_fin:
      (nextAssignment.fecha_hora_fin as string | undefined) ?? null,
    routeCoordinates,
    controlPoints,
  };
}

export default function DriverMapView() {
  const heading = useHeading(true);
  const mapOrientation = useMapOrientation({
    enabled: true,
    heading: heading.heading,
    location: heading.location,
  });
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [assignment, setAssignment] = useState<RouteAssignment | null>(null);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false);
  const networkState = useNetworkState();
  const [mapAttempt, setMapAttempt] = useState(0);
  const isOffline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;
  const wasOffline = useRef(isOffline);
  const pointerSize =
    Math.min(Dimensions.get("window").width, Dimensions.get("window").height) /
    15;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const pointerStyles = isTrackingActive ? pointerActive : pointerInactive;

  useEffect(() => {
    setTracksViewChanges(true);
    const timeout = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    setTracksViewChanges(true);
    const timeout = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timeout);
  }, [isTrackingActive, pointerSize]);

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      setMapAttempt((attempt) => attempt + 1);
    }
    wasOffline.current = isOffline;
  }, [isOffline]);

  const loadAssignment = async () => {
    setIsLoadingAssignment(true);

    try {
      const data = await apiRequest<unknown>("/conductor/asignacion");
      const normalized = normalizeRouteAssignment(data);
      setAssignment(normalized);
    } catch (error) {
      setAssignment(null);
      console.warn("No se pudo cargar la asignación activa:", error);
    } finally {
      setIsLoadingAssignment(false);
    }
  };

  useEffect(() => {
    void loadAssignment();
  }, []);

  if (!heading.location) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        {heading.error ? (
          <Text style={styles.statusText}>{heading.error}</Text>
        ) : (
          <>
            {!isOffline && <ActivityIndicator size="large" />}
            <Text style={styles.statusText}>
              {isOffline
                ? "Sin conexión a Internet. Google Maps no puede cargar el mapa."
                : "Obteniendo tu ubicación..."}
            </Text>
          </>
        )}
      </ThemedView>
    );
  }

  const currentLocation = heading.location;

  const hasAssignment = Boolean(
    assignment && assignment.routeCoordinates.length > 0,
  );

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.assignmentHeader,
          hasAssignment
            ? styles.assignmentHeaderActive
            : styles.assignmentHeaderInactive,
        ]}
      >
        <View style={styles.assignmentHeaderTextWrap}>
          <Text style={styles.assignmentHeaderLabel}>
            {hasAssignment ? "Ruta asignada" : "Sin ruta asignada"}
          </Text>
          {hasAssignment ? (
            <Text style={styles.assignmentHeaderMeta}>
              {assignment?.numero_ruta
                ? `Ruta ${assignment.numero_ruta}`
                : `Asignación ${assignment?.id_asignacion ?? "-"}`}
            </Text>
          ) : (
            <Text style={styles.assignmentHeaderMeta}>
              Busca una asignación disponible
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refrescar asignación"
          style={styles.refreshButton}
          onPress={() => {
            void loadAssignment();
          }}
          disabled={isLoadingAssignment}
        >
          <SymbolView
            name={{
              ios: "arrow.clockwise",
              android: "refresh",
              web: "refresh",
            }}
            size={18}
            tintColor="#ffffff"
          />
        </Pressable>
      </View>

      <MapView
        key={mapAttempt}
        ref={mapOrientation.mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onMapReady={() => {
          mapOrientation.mapRef.current?.animateCamera(
            {
              center: {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              },
              heading: -mapOrientation.cameraHeading,
              pitch: 0,
            },
            { duration: 200 },
          );
        }}
        rotateEnabled={mapOrientation.mode !== "north"}
        pitchEnabled={false}
        onPanDrag={mapOrientation.stopFollowing}
        onRegionChangeStart={(_, details) => {
          if (details.isGesture) mapOrientation.stopFollowing();
        }}
      >
        {assignment && assignment.routeCoordinates.length > 1 && (
          <Polyline
            coordinates={assignment.routeCoordinates}
            strokeColor="#1d4ed8"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {assignment?.controlPoints.map((point) => (
          <Fragment key={point.id}>
            <Circle
              center={point.coordinate}
              radius={point.radius}
              strokeColor="#4C1D95"
              strokeWidth={3}
              fillColor="rgba(109, 40, 217, 0.32)"
            />
            <Marker
              coordinate={point.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges
              accessibilityLabel={`Punto de control ${point.relativeNumber ?? point.id}`}
            >
              <View style={styles.controlPointMarker}>
                <SymbolView
                  name={{
                    ios: "flag.checkered",
                    android: "flag",
                    web: "flag",
                  }}
                  size={16}
                  tintColor="#FFFFFF"
                />
              </View>
            </Marker>
          </Fragment>
        ))}

        <Marker
          key={isTrackingActive ? "marker-active" : "marker-inactive"}
          coordinate={{
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }}
          rotation={
            mapOrientation.mode === "follow" ? mapOrientation.pointerHeading : 0
          }
          flat
          tracksViewChanges={tracksViewChanges}
          anchor={{ x: 0.5, y: 0.5 }}
          accessibilityLabel="Ubicación y dirección del vehículo"
        >
          <View
            style={[
              styles.vehiclePointer,
              {
                width: pointerSize,
                height: pointerSize,
                backgroundColor: pointerStyles.bgColor,
                borderColor: pointerStyles.borderColor,
              },
            ]}
          >
            <SymbolView
              name={{
                ios: "location.north.fill",
                android: "navigation",
                web: "navigation",
              }}
              size={pointerSize * 0.68}
              tintColor="#000000"
            />
          </View>
        </Marker>
      </MapView>

      <View style={styles.mapControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            mapOrientation.mode === "north"
              ? "Norte arriba. Tocar para seguir la ubicación"
              : mapOrientation.mode === "follow"
                ? "Siguiendo ubicación. Tocar para seguir y rotar"
                : "Siguiendo y rotando. Tocar para orientar al norte"
          }
          accessibilityState={{ selected: mapOrientation.mode !== "north" }}
          onPress={mapOrientation.cycleMode}
          style={[
            styles.orientationButton,
            mapOrientation.mode === "follow" && styles.followButton,
            mapOrientation.mode === "rotate" && styles.rotateButton,
          ]}
        >
          <SymbolView
            name={{
              ios: "location.north.fill",
              android: "navigation",
              web: "navigation",
            }}
            size={24}
            tintColor={mapOrientation.mode === "north" ? "#17324D" : "#087F8C"}
            style={{
              transform: [
                {
                  rotate:
                    mapOrientation.mode === "rotate"
                      ? `${-mapOrientation.cameraHeading}deg`
                      : "0deg",
                },
              ],
            }}
          />
        </Pressable>
        {heading.source === "compass" &&
          heading.accuracy !== null &&
          heading.accuracy <= 1 && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Mueve el teléfono en forma de 8 para calibrar
              </Text>
            </View>
          )}
      </View>

      {isOffline && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={styles.offlineNotice}
        >
          <View style={styles.offlineCopy}>
            <Text style={styles.offlineTitle}>
              Google Maps no está disponible
            </Text>
            <Text style={styles.offlineMessage}>
              Sin conexión a Internet. Comprueba tu conexión para cargar el
              mapa.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar el mapa"
            onPress={() => setMapAttempt((attempt) => attempt + 1)}
            hitSlop={8}
            style={styles.retryButton}
          >
            <SymbolView
              name={{
                ios: "arrow.clockwise",
                android: "refresh",
                web: "refresh",
              }}
              size={20}
              tintColor="#17324D"
            />
          </Pressable>
        </View>
      )}

      <DriverTrackingControls
        changeIsTrackingActive={setIsTrackingActive}
        assignment={assignment}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  statusText: {
    color: "#17324D",
    fontSize: 15,
  },
  assignmentHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
  },
  assignmentHeaderActive: {
    backgroundColor: "rgba(30, 64, 175, 0.9)",
  },
  assignmentHeaderInactive: {
    backgroundColor: "rgba(107, 114, 128, 0.88)",
  },
  assignmentHeaderTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  assignmentHeaderLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  assignmentHeaderMeta: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  mapControls: {
    position: "absolute",
    top: 96,
    left: 16,
    zIndex: 10,
  },
  orientationButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    elevation: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  followButton: {
    backgroundColor: "#E2EEF3",
  },
  rotateButton: {
    backgroundColor: "#D8EBE8",
  },
  vehiclePointer: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 3,
    elevation: 8,
    shadowColor: "#062C32",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  controlPointMarker: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#6D28D9",
    elevation: 6,
    shadowColor: "#2E1065",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  notice: {
    maxWidth: 220,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    elevation: 3,
  },
  noticeText: {
    color: "#17324D",
    fontSize: 12,
    fontWeight: "500",
  },
  offlineNotice: {
    position: "absolute",
    top: 16,
    left: 76,
    right: 16,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 9,
    borderLeftWidth: 4,
    borderLeftColor: "#C44D3F",
    borderRadius: 6,
    backgroundColor: "#FFF8F5",
    elevation: 5,
    zIndex: 20,
  },
  offlineCopy: {
    flex: 1,
    gap: 3,
  },
  offlineTitle: {
    color: "#7D261E",
    fontSize: 13,
    fontWeight: "700",
  },
  offlineMessage: {
    color: "#493B38",
    fontSize: 12,
  },
  retryButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#F2E4DF",
  },
});
