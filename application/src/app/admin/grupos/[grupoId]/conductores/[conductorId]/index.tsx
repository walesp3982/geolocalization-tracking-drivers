import { gruposService } from "@/services/gruposService";
import { ConductorDetalle } from "@/types/grupo";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DetalleConductorScreen() {
  const { grupoId, conductorId } = useLocalSearchParams<{
    grupoId: string;
    conductorId: string;
  }>();
  const router = useRouter();
  const [conductor, setConductor] = useState<ConductorDetalle | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!grupoId || !conductorId) return;
    try {
      setConductor(await gruposService.obtenerConductor(grupoId, conductorId));
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo cargar el conductor",
      );
    } finally {
      setCargando(false);
    }
  }, [grupoId, conductorId]);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      void cargar();
    }, [cargar]),
  );

  if (cargando) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!conductor) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>No se encontró el conductor.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.action}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.action}>Volver a conductores</Text>
        </TouchableOpacity>
        <View style={styles.heading}>
          <View style={styles.identity}>
            <Text style={styles.title}>{conductor.nombre}</Text>
            <Text style={styles.status}>{conductor.activo ? "Activo" : "Inactivo"}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              router.push({
                pathname: "/admin/grupos/[grupoId]/conductores/[conductorId]/editar",
                params: { grupoId, conductorId },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Código</Text>
          <Text style={styles.value}>{conductor.code}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Teléfono</Text>
          <Text style={styles.value}>{conductor.telefono || "Sin teléfono"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Grupo</Text>
          <Text style={styles.value}>{conductor.id_grupo}</Text>
        </View>

        <Text style={styles.sectionTitle}>Rutas asignadas</Text>
        {conductor.rutas.length ? (
          <View style={styles.list}>
            {conductor.rutas.map((ruta) => (
              <View style={styles.listRow} key={`${ruta.id}-${ruta.horaInicio ?? ""}`}>
                <View style={styles.routeMark} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{ruta.nombre}</Text>
                  {ruta.horaInicio ? (
                    <Text style={styles.rowSubtitle}>Inicio {ruta.horaInicio}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No tiene rutas asignadas.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center" },
  content: { padding: 18 },
  action: { color: "#2563eb", fontWeight: "600", marginBottom: 14 },
  heading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  identity: { flex: 1 },
  title: { color: "#111827", fontSize: 23, fontWeight: "700" },
  status: { color: "#047857", fontSize: 13, marginTop: 4 },
  editButton: {
    borderColor: "#cbd5e1",
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  editText: { color: "#1f2937", fontWeight: "600" },
  infoRow: {
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  label: { color: "#6b7280", fontSize: 13 },
  value: { color: "#111827", fontSize: 14, fontWeight: "600" },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "700", marginTop: 24, marginBottom: 8 },
  list: { borderTopColor: "#e5e7eb", borderTopWidth: StyleSheet.hairlineWidth },
  listRow: { alignItems: "center", borderBottomColor: "#e5e7eb", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, minHeight: 62, paddingVertical: 10 },
  routeMark: { backgroundColor: "#0f766e", borderRadius: 3, height: 28, width: 4 },
  rowText: { flex: 1 },
  rowTitle: { color: "#1f2937", fontSize: 14, fontWeight: "600" },
  rowSubtitle: { color: "#6b7280", fontSize: 12, marginTop: 3 },
  empty: { color: "#6b7280", paddingVertical: 12 },
});
