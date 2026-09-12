import { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/themed-view";
import LoginScreen from "@/components/login-screen";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { iniciarRastreoUbicacion } from "@/services/locationService";
import * as Location from "expo-location";
import { Button, StyleSheet, ActivityIndicator, Text } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
// NUEVO: pantalla de panel de administración (tabla de grupos)
import PanelAdminScreen from "./admin/grupos";

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
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Si quien inició sesión es admin, no necesitamos pedir ubicación
    if (!sesionIniciada || rol !== "chofer") return;

    let suscripcion: Location.LocationSubscription | null = null;
    let cancelado = false;

    const obtenerUbicacion = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setErrorUbicacion("Permiso de ubicación denegado");
          return;
        }

        if (!(await Location.hasServicesEnabledAsync())) {
          setErrorUbicacion("Activa la ubicación del dispositivo para continuar");
          return;
        }

        const actualizarMapa = (ubicacion: Location.LocationObject) => {
          if (cancelado) return;

          const nuevaRegion: MapRegion = {
            latitude: ubicacion.coords.latitude,
            longitude: ubicacion.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };

          setRegion(nuevaRegion);
          mapRef.current?.animateToRegion(nuevaRegion, 500);
        };

        const ubicacionActual = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        actualizarMapa(ubicacionActual);

        suscripcion = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 1,
            timeInterval: 5000,
          },
          actualizarMapa,
        );
      } catch (error) {
        console.error("No se pudo obtener la ubicación actual:", error);
        setErrorUbicacion("No se pudo obtener tu ubicación actual");
      }
    };

    obtenerUbicacion();

    return () => {
      cancelado = true;
      suscripcion?.remove();
    };
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

  if (errorUbicacion) {
    return (
      <ThemedView style={styles.container}>
        <Text>{errorUbicacion}</Text>
      </ThemedView>
    );
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
      <AllowButtonLocation />
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{
          flex: 1,
        }}
        initialRegion={region}
        showsUserLocation
      />
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