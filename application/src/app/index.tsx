import LoginScreen from "@/components/login-screen";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useHeading } from "@/hooks/use-heading";
import { useMapOrientation } from "@/hooks/use-map-orientation";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
// NUEVO: pantalla de panel de administración (tabla de grupos)
import DriverMap from "@/components/DriverButtonTracking";
import PanelAdminScreen from "./admin/grupos/index";

// NUEVO: qué tipo de usuario inició sesión
type Rol = "chofer" | "admin";

export default function HomeScreen() {
  const [sesionIniciada, setSesionIniciada] = useState(false);
  // NUEVO: guardamos qué rol inició sesión
  const [rol, setRol] = useState<Rol | null>(null);

  const trackingEnabled = sesionIniciada && rol === "chofer";
  const heading = useHeading(trackingEnabled);
  const mapOrientation = useMapOrientation({
    enabled: trackingEnabled,
    heading: heading.heading,
    location: heading.location,
  });

  if (!sesionIniciada) {
    // NUEVO: LoginScreen ahora nos dice qué rol inició sesión
    return (
      <LoginScreen
        onLoginExitoso={(rolElegido: Rol) => {
          setRol(rolElegido);
          setSesionIniciada(true);
        }}
      />
    );
  }

  // NUEVO: si es admin, mostramos el panel directo, nada de mapa ni ubicación
  if (rol === "admin") {
    return <PanelAdminScreen />;
  }

  if (!heading.location) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center" }]}>
        {heading.error ? (
          <Text>{heading.error}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <Text>Obteniendo tu ubicación...</Text>
          </>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <MapView
        ref={mapOrientation.mapRef}
        provider={PROVIDER_GOOGLE}
        style={{
          flex: 1,
        }}
        initialRegion={{
          latitude: heading.location.coords.latitude,
          longitude: heading.location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        rotateEnabled={mapOrientation.mode !== "north"}
        pitchEnabled={false}
        onPanDrag={mapOrientation.stopFollowing}
        onRegionChangeStart={(_, details) => {
          if (details.isGesture) mapOrientation.stopFollowing();
        }}
      >
        <Marker
          coordinate={{
            latitude: heading.location.coords.latitude,
            longitude: heading.location.coords.longitude,
          }}
          rotation={heading.heading ?? 0}
          flat
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.headingMarker}>
            <SymbolView
              name={{
                ios: "location.north.fill",
                android: "navigation",
                web: "navigation",
              }}
              size={32}
              tintColor="#147D92"
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
            mapOrientation.mode === "follow" &&
              styles.orientationButtonFollowing,
            mapOrientation.mode === "rotate" && styles.orientationButtonActive,
          ]}
        >
          <SymbolView
            name={{
              ios: "location.north.fill",
              android: "navigation",
              web: "navigation",
            }}
            size={24}
            tintColor={mapOrientation.mode === "north" ? "#17324D" : "#147D92"}
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
            <View style={styles.calibrationNotice}>
              <Text style={styles.calibrationText}>
                Mueve el teléfono en forma de 8 para calibrar
              </Text>
            </View>
          )}
      </View>
      <DriverMap />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
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
    backgroundColor: "#ffffff",
    elevation: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  orientationButtonActive: {
    backgroundColor: "#D8EBE8",
  },
  orientationButtonFollowing: {
    backgroundColor: "#E2EEF3",
  },
  headingMarker: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#E9F4F1",
  },
  calibrationNotice: {
    maxWidth: 220,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    elevation: 3,
  },
  calibrationText: {
    color: "#17324D",
    fontSize: 12,
    fontWeight: "500",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
