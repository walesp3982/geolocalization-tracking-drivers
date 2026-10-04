import DriverTrackingControls from "@/components/DriverButtonTracking";
import { ThemedView } from "@/components/themed-view";
import { useHeading } from "@/hooks/use-heading";
import { useMapOrientation } from "@/hooks/use-map-orientation";
import { useNetworkState } from "expo-network";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

interface PointerColors {
  bgColor: string;
  borderColor: string;
}

const pointerActive: PointerColors = {
  bgColor: "#2ed37b",
  borderColor: "#7af622",
};

const pointerInactive: PointerColors = {
  bgColor: "#f7d653",
  borderColor: "#ffca1c",
};
export default function DriverMapView() {
  const heading = useHeading(true);
  const mapOrientation = useMapOrientation({
    enabled: true,
    heading: heading.heading,
    location: heading.location,
  });
  const [isTrackingActive, setIsTrackingActive] = useState(false);
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

  return (
    <ThemedView style={styles.container}>
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

      <DriverTrackingControls changeIsTrackingActive={setIsTrackingActive} />
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
  mapControls: {
    position: "absolute",
    top: 16,
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
