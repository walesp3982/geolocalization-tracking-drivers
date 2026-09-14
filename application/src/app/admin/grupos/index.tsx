import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Grupo } from "@/types/grupo";
import { gruposService } from "@/services/gruposService";

export default function PanelAdminScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const esPantallaChica = width < 380;

  const cargarGrupos = useCallback(async () => {
    try {
      setError(null);
      const data = await gruposService.listar();
      setGrupos(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con el backend");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargarGrupos();
    }, [cargarGrupos])
  );

  const handleEliminar = (grupo: Grupo) => {
    Alert.alert(
      "Eliminar grupo",
      `¿Seguro que quieres eliminar "${grupo.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setEliminandoId(grupo.id);
            try {
              await gruposService.eliminar(grupo.id);
              setGrupos((prev) => prev.filter((g) => g.id !== grupo.id));
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "No se pudo eliminar");
            } finally {
              setEliminandoId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel de administración</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("./crear")}
        >
          <Text style={styles.addButtonText}>+ Agregar grupo</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={styles.errorText}>
          {error}. Revisa que el backend esté corriendo y que EXPO_PUBLIC_API_URL
          apunte a la IP correcta (10.0.2.2 en el emulador Android).
        </Text>
      )}

      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.headerCell, styles.colNombre]}>Grupo</Text>
        <Text style={[styles.headerCell, styles.colRepresentante]}>
          Representante
        </Text>
        <Text style={[styles.headerCell, styles.colAcciones]}>Acciones</Text>
      </View>

      <FlatList
        data={grupos}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !error ? <Text style={styles.emptyText}>Todavía no hay grupos.</Text> : null
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.row,
              index % 2 === 0 ? styles.rowPar : styles.rowImpar,
            ]}
          >
            <View style={styles.colNombre}>
              <Text style={styles.cell} numberOfLines={esPantallaChica ? 2 : 1}>
                {item.nombre}
              </Text>
              {item.lineas.length > 0 && (
                <Text style={styles.subCell} numberOfLines={1}>
                  Línea {item.lineas.join(", ")}
                </Text>
              )}
            </View>

            <Text
              style={[
                styles.cell,
                styles.colRepresentante,
                !item.representante && styles.cellVacio,
              ]}
              numberOfLines={2}
            >
              {item.representante ? item.representante.nombre : "Sin asignar"}
            </Text>

            <View style={[styles.colAcciones, styles.acciones]}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push({
                  pathname: "[grupoId]" as any,
                  params: { grupoId: item.id }
                })}
              >
                <Text style={styles.iconText}>👁️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push({
                  pathname: "[grupoId]/editar" as any,
                  params: { grupoId: item.id }
                })}
              >
                <Text style={styles.iconText}>✏️</Text>
              </TouchableOpacity>
              {eliminandoId === item.id ? (
                <ActivityIndicator size="small" style={styles.iconButton} />
              ) : (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleEliminar(item)}
                >
                  <Text style={styles.iconText}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    rowGap: 8,
  },
  title: { fontSize: 20, fontWeight: "700", flexShrink: 1, marginRight: 8 },
  addButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  headerRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  rowPar: { backgroundColor: "#f9fafb" },
  rowImpar: { backgroundColor: "#fff" },
  cell: { fontSize: 14, color: "#111827" },
  subCell: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  cellVacio: { color: "#9ca3af", fontStyle: "italic" },
  colNombre: { flex: 0.32 },
  colRepresentante: { flex: 0.36 },
  colAcciones: { flex: 0.32 },
  acciones: { flexDirection: "row", justifyContent: "flex-end" },
  iconButton: { paddingHorizontal: 5, paddingVertical: 4 },
  iconText: { fontSize: 16 },
  emptyText: { textAlign: "center", color: "#6b7280", marginTop: 40 },
  errorText: { color: "#dc2626", marginBottom: 10, fontSize: 12 },
});