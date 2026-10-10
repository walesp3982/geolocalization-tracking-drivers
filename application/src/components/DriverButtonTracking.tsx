import useDriverTracking from "@/hooks/use-driver-tracking";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface RouteAssignmentMeta {
  id_asignacion?: number;
  id_ruta?: number;
  numero_ruta?: string;
  lugar_inicial?: string;
  lugar_final?: string;
  tiempo_estimado?: number | null;
  fecha_hora_inicio?: string | null;
  fecha_hora_comienzo?: string | null;
  fecha_hora_fin?: string | null;
  estado_tracking?: string | null;
}

interface DriverButtonProps {
  changeIsTrackingActive: (active: boolean) => void;
  assignment?: RouteAssignmentMeta | null;
  canStart: boolean;
  onCheckpointReached: (checkpointId: number) => void;
  onTrackingFinished: (result: { success: boolean; status?: string }) => void;
}
export default function DriverButtonTracking({
  changeIsTrackingActive,
  assignment,
  canStart,
  onCheckpointReached,
  onTrackingFinished,
}: DriverButtonProps) {
  const location = useDriverTracking(
    assignment?.id_asignacion,
    onCheckpointReached,
    onTrackingFinished,
  );

  useEffect(() => {
    changeIsTrackingActive(location.running);
    return () => changeIsTrackingActive(false);
  }, [changeIsTrackingActive, location.running]);

  return (
    <View style={styles.floatingCard}>
      {assignment && (
        <View style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>
            {assignment.numero_ruta
              ? `Ruta ${assignment.numero_ruta}`
              : `Asignación ${assignment.id_asignacion ?? "-"}`}
          </Text>

          <Text style={styles.assignmentText}>
            {assignment.lugar_inicial ?? "Origen no disponible"} →{" "}
            {assignment.lugar_final ?? "Destino no disponible"}
          </Text>

          <View style={styles.metaGrid}>
            {assignment.id_ruta !== undefined && (
              <Text style={styles.metaText}>ID ruta: {assignment.id_ruta}</Text>
            )}
            {assignment.tiempo_estimado !== null &&
              assignment.tiempo_estimado !== undefined && (
                <Text style={styles.metaText}>
                  Tiempo estimado: {assignment.tiempo_estimado} min
                </Text>
              )}
            {assignment.fecha_hora_inicio && (
              <Text style={styles.metaText}>
                Inicio:{" "}
                {new Date(assignment.fecha_hora_inicio).toLocaleString()}
              </Text>
            )}
            {assignment.fecha_hora_comienzo && (
              <Text style={styles.metaText}>
                Comienzo:{" "}
                {new Date(assignment.fecha_hora_comienzo).toLocaleString()}
              </Text>
            )}
            {assignment.estado_tracking && (
              <Text style={styles.metaText}>
                Tracking: {assignment.estado_tracking}
              </Text>
            )}
            {assignment.fecha_hora_fin && (
              <Text style={styles.metaText}>
                Fin: {new Date(assignment.fecha_hora_fin).toLocaleString()}
              </Text>
            )}
            {!assignment.fecha_hora_fin &&
              assignment.fecha_hora_inicio && (
                <Text style={styles.metaText}>
                  Fin estimado: {new Date(
                    new Date(assignment.fecha_hora_inicio).getTime() +
                      (assignment.tiempo_estimado ?? 60) * 60 * 1000,
                  ).toLocaleString()}
                </Text>
              )}
          </View>
        </View>
      )}

      <View style={styles.divider} />

      {/* Estado del GPS */}
      {location.error && <Text style={styles.errorText}>{location.error}</Text>}

      {/* Botón de control de rastreo */}
      <TouchableOpacity
        style={[
          styles.button,
          location.running ? styles.buttonStop : styles.buttonStart,
          (!canStart ||
            location.status === "connecting" ||
            location.status === "waiting_start") &&
            !location.running &&
            styles.buttonDisabled,
        ]}
        disabled={
          (!canStart ||
            location.status === "connecting" ||
            location.status === "waiting_start") &&
          !location.running
        }
        onPress={
          location.running ? location.stopTracking : location.startTracking
        }
      >
        <Text style={styles.buttonText}>
          {location.running
            ? location.status === "stopping"
              ? "Finalizando..."
              : "Detener Rastreo"
            : location.status === "connecting" ||
                location.status === "waiting_start"
              ? "Validando inicio..."
              : assignment?.estado_tracking === "in_progress"
                ? "Reanudar Rastreo"
                : "Iniciar Rastreo"}
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
  assignmentCard: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dfe7f1",
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17324D",
    marginBottom: 4,
  },
  assignmentText: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
  },
  metaGrid: {
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#334155",
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
  buttonDisabled: {
    backgroundColor: "#9ca3af",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
