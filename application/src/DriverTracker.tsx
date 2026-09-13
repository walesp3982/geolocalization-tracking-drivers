import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import rutasData from "../assets/rutas_minibuses_2.json";

export default function DriverTracker() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const isMounted = useRef<boolean>(true);

  const [lineaSeleccionada, setLineaSeleccionada] = useState<any>(rutasData[0]);
  const [esIda, setEsIda] = useState<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (isMounted.current) {
          setErrorMsg("Permiso de ubicación denegado");
        }
        Alert.alert(
          "Error",
          "Se requiere permiso de ubicación para continuar.",
        );
        return;
      }

      if (isMounted.current) {
        setErrorMsg(null);
        setIsTracking(true);
      }

      console.log("📡 Iniciando rastreo de ubicación...");

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 0,
        },
        (newLocation) => {
          console.log(
            "📍 Coordenadas (cada 5s):",
            newLocation.coords.latitude,
            newLocation.coords.longitude,
            "| Línea:",
            lineaSeleccionada.linea,
            "| Sentido:",
            esIda ? "Ida" : "Vuelta",
          );
          if (isMounted.current) {
            setLocation(newLocation);
          }
        },
      );
    } catch (error) {
      console.error("❌ Error al iniciar rastreo:", error);
      if (isMounted.current) {
        setErrorMsg("Error al activar el GPS");
      }
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (isMounted.current) {
      setIsTracking(false);
    }
    console.log("🛑 Rastreo detenido");
  };

  return (
    <View style={styles.floatingCard}>
      <View style={styles.routesContainer}>
        <Text style={styles.sectionTitle}>Seleccionar Línea:</Text>
        <View style={styles.lineChipsRow}>
          {rutasData.map((item: any) => (
            <TouchableOpacity
              key={item.linea}
              style={[
                styles.chipBtn,
                lineaSeleccionada.linea === item.linea && styles.chipBtnActive,
              ]}
              onPress={() => setLineaSeleccionada(item)}
            >
              <Text
                style={[
                  styles.chipText,
                  lineaSeleccionada.linea === item.linea &&
                    styles.chipTextActive,
                ]}
              >
                {item.linea}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sentidoRow}>
          <TouchableOpacity
            style={[
              styles.sentidoBtn,
              esIda ? styles.btnIda : styles.btnInactive,
            ]}
            onPress={() => setEsIda(true)}
          >
            <Text style={styles.btnTextSentido}>Ida</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sentidoBtn,
              !esIda ? styles.btnVuelta : styles.btnInactive,
            ]}
            onPress={() => setEsIda(false)}
          >
            <Text style={styles.btnTextSentido}>Vuelta</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {errorMsg ? (
        <Text style={styles.errorText}>{errorMsg}</Text>
      ) : location ? (
        <Text style={styles.text}>
          Lat: {location.coords.latitude.toFixed(4)}, Lng:{" "}
          {location.coords.longitude.toFixed(4)}
        </Text>
      ) : (
        <Text style={styles.text}>Estado: Inactivo</Text>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          isTracking ? styles.buttonStop : styles.buttonStart,
        ]}
        onPress={isTracking ? stopTracking : startTracking}
      >
        <Text style={styles.buttonText}>
          {isTracking ? "Detener Rastreo" : "Iniciar Rastreo"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingCard: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    elevation: 20,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  routesContainer: {
    width: "100%",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
  },
  lineChipsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  chipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#dcdcdc",
  },
  chipBtnActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#333333",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  sentidoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  sentidoBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  btnIda: {
    backgroundColor: "#28a745",
  },
  btnVuelta: {
    backgroundColor: "#fd7e14",
  },
  btnInactive: {
    backgroundColor: "#e0e0e0",
  },
  btnTextSentido: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: "#eeeeee",
    width: "100%",
    marginVertical: 10,
  },
  text: {
    fontSize: 14,
    color: "#333333",
    marginBottom: 8,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 14,
    color: "#d9534f",
    marginBottom: 8,
  },
  button: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonStart: {
    backgroundColor: "#007AFF",
  },
  buttonStop: {
    backgroundColor: "#dc3545",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
