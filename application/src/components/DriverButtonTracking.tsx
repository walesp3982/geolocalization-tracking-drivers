import useDriverTracking from "@/hooks/use-driver-tracking";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface DriverButtonProps {
  changeIsTrackingActive: (active: boolean) => void;
}
export default function DriverButtonTracking({
  changeIsTrackingActive,
}: DriverButtonProps) {
  const location = useDriverTracking();

  // Estados para la selección de ruta y sentido
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    console.log("location.running", location.running);
    changeIsTrackingActive(location.running);

    return () => {
      console.log("Cleaning up location subscription");
      changeIsTrackingActive(false);
    };
  }, [location.running]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  return (
    <View style={styles.floatingCard}>
      <View style={styles.divider} />

      {/* Estado del GPS */}
      {location.error ? (
        <Text style={styles.errorText}>{location.error}</Text>
      ) : location ? (
        <Text style={styles.text}>
          Lat: {location.location?.latitude.toFixed(4)}, Lng:{" "}
          {location.location?.longitude.toFixed(4)}
        </Text>
      ) : (
        <Text style={styles.text}>Estado: Inactivo</Text>
      )}

      {/* Botón de control de rastreo */}
      <TouchableOpacity
        style={[
          styles.button,
          location.running ? styles.buttonStop : styles.buttonStart,
        ]}
        onPress={
          location.running ? location.stopTracking : location.startTracking
        }
      >
        <Text style={styles.buttonText}>
          {location.running ? "Detener Rastreo" : "Iniciar Rastreo"}
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
    backgroundColor: "#e42e41",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
