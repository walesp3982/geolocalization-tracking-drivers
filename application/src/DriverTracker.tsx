import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Mock temporal de datos hasta que el backend envíe las rutas
const rutasData = [
  { id: "1", linea: "Línea 1" },
  { id: "2", linea: "Línea 2" },
  { id: "3", linea: "Línea 3" },
];

export default function DriverTracker() {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [lineaSeleccionada, setLineaSeleccionada] = useState<any>(rutasData[0]);
  const [esIda, setEsIda] = useState<boolean>(true);

  const toggleTracking = () => {
    setIsTracking((prev) => !prev);
  };

  return (
    <View style={styles.floatingCard}>
      <View style={styles.routesContainer}>
        <Text style={styles.sectionTitle}>Seleccionar Línea:</Text>
        <View style={styles.lineChipsRow}>
          {rutasData.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.chipBtn,
                lineaSeleccionada.id === item.id && styles.chipBtnActive,
              ]}
              onPress={() => setLineaSeleccionada(item)}
            >
              <Text
                style={[
                  styles.chipText,
                  lineaSeleccionada.id === item.id && styles.chipTextActive,
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

      <Text style={styles.text}>
        Estado: {isTracking ? "Rastreando..." : "Inactivo"}
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          isTracking ? styles.buttonStop : styles.buttonStart,
        ]}
        onPress={toggleTracking}
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
