import LoginScreen from "@/components/login-screen";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { iniciarRastreoUbicacion } from "@/services/locationService";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
// NUEVO: pantalla de panel de administración (tabla de grupos)
import DriverMap from "@/components/DriverMap";
import { useCurrentLocation } from "@/hooks/use-current-location";
import PanelAdminScreen from "./admin/grupos/index";

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// NUEVO: qué tipo de usuario inició sesión
type Rol = "chofer" | "admin";

function AllowButtonLocation() {
  return (
    <Button
      onPress={iniciarRastreoUbicacion}
      title="Habilitar ubicaciónn"
    ></Button>
  );
}

export default function HomeScreen() {
  const [sesionIniciada, setSesionIniciada] = useState(false);
  // NUEVO: guardamos qué rol inició sesión
  const [rol, setRol] = useState<Rol | null>(null);
  const [region, setRegion] = useState<MapRegion | null>(null);

  const mapRef = useRef<MapView>(null);

  const currentLocation = useCurrentLocation();
  useEffect(() => {
    // Si quien inició sesión es admin, no necesitamos pedir ubicación
    if (!sesionIniciada || rol !== "chofer") return;

    const obtenerUbication = async () => {
      let ubication = await currentLocation.getCurrentLocation();

      const nuevaRegion: MapRegion = {
        latitude: ubication.coords.latitude,
        longitude: ubication.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(nuevaRegion);
      mapRef.current?.animateToRegion(nuevaRegion, 500);
    };

    obtenerUbication();
  }, [sesionIniciada, rol]);

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

  if (!region) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" />
        <Text>Obteniendo tu ubicación...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{
          flex: 1,
        }}
        initialRegion={region}
        showsUserLocation
      />
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
