import { gruposService } from "@/services/gruposService";
import { Grupo } from "@/types/grupo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DetalleGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!grupoId) return;
    try {
      setError(null);
      const data = await gruposService.obtener(grupoId);
      setGrupo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el grupo");
    } finally {
      setLoading(false);
    }
  }, [grupoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error || !grupo) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Grupo no encontrado"}</Text>
      </SafeAreaView>
    );
  }

  const choferesActivos = grupo.choferes.filter((c) => c.activo);
  const rutasDisponibles = grupo.rutasDisponibles ?? [];
  const maxListHeight = Math.max(150, Math.min(260, Math.floor(height * 0.3)));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Volver a grupos</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{grupo.nombre}</Text>
        <Text style={styles.subtitle}>
          {grupo.representante
            ? `Representante: ${grupo.representante.nombre} · ${grupo.representante.telefono || "Sin teléfono"}`
            : "Sin representante asignado"}
        </Text>
        <TouchableOpacity
          style={styles.leaderButton}
          onPress={() =>
            router.push({
              pathname: "/admin/grupos/[grupoId]/editar",
              params: { grupoId },
            })
          }
          accessibilityRole="button"
        >
          <Text style={styles.leaderButtonText}>
            {grupo.representante ? "Cambiar jefe" : "Asignar jefe"}
          </Text>
        </TouchableOpacity>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Conductores</Text>
            <Text style={styles.sectionMeta}>
              {choferesActivos.length} activos
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              router.push({
                pathname: "/admin/grupos/[grupoId]/conductores/crear",
                params: { grupoId },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Nuevo conductor</Text>
          </TouchableOpacity>
        </View>
        {choferesActivos.length ? (
          <ScrollView
            style={[styles.scrollList, { maxHeight: maxListHeight }]}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <View style={styles.listRows}>
              {choferesActivos.map((chofer) => (
                <TouchableOpacity
                  key={chofer.id}
                  style={styles.listRow}
                  onPress={() =>
                    router.push({
                      pathname:
                        "/admin/grupos/[grupoId]/conductores/[conductorId]",
                      params: { grupoId, conductorId: chofer.id },
                    })
                  }
                  accessibilityRole="button"
                >
                  <View style={styles.driverMark} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {chofer.nombre}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      {chofer.rutas.length} ruta(s) asignada(s)
                    </Text>
                  </View>
                  <Text style={styles.rowArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>
            Este grupo todavía no tiene choferes activos.
          </Text>
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Rutas disponibles</Text>
            <Text style={styles.sectionMeta}>
              {rutasDisponibles.length} sin asignar
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              router.push({
                pathname: "/admin/grupos/[grupoId]/rutas/crear",
                params: { grupoId },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Nueva ruta</Text>
          </TouchableOpacity>
        </View>
        {rutasDisponibles.length ? (
          <ScrollView
            style={[styles.scrollList, { maxHeight: maxListHeight }]}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <View style={styles.listRows}>
              {rutasDisponibles.map((ruta) => (
                <View key={ruta.id} style={styles.listRow}>
                  <View style={styles.routeMark} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {ruta.nombre}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      Disponible para asignación
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>
            No hay rutas disponibles para asignar.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 28 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#4b5563", marginTop: 4, marginBottom: 16 },
  leaderButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 2,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  leaderButtonText: { color: "#047857", fontSize: 13, fontWeight: "700" },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionMeta: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  addButton: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  scrollList: {
    borderTopColor: "#e5e7eb",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },
  listRows: { paddingBottom: 2 },
  listRow: {
    alignItems: "center",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 5,
    paddingVertical: 10,
  },
  driverMark: {
    backgroundColor: "#2563eb",
    borderRadius: 3,
    height: 30,
    width: 4,
  },
  routeMark: {
    backgroundColor: "#0f766e",
    borderRadius: 3,
    height: 30,
    width: 4,
  },
  rowCopy: { flex: 1 },
  rowTitle: { color: "#1f2937", fontSize: 14, fontWeight: "600" },
  rowSubtitle: { color: "#6b7280", fontSize: 12, marginTop: 3 },
  rowArrow: { color: "#94a3b8", fontSize: 24, paddingHorizontal: 6 },
  emptyText: { textAlign: "center", color: "#6b7280", marginTop: 20 },
  errorText: { color: "#dc2626" },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    marginTop: 8,
  },
  backButtonText: { color: "#2563eb", fontWeight: "600" },
});
